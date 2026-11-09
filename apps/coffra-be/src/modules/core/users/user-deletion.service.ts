import { ConflictException, Inject, Injectable, type OnModuleInit, UnauthorizedException } from '@nestjs/common'
import { DiscoveryService } from '@nestjs/core'

import { PrismaService } from '../../prisma'
import { OwnershipService } from '../ownership/ownership.service'

import { USER_DELETION_TIMEOUT_MS } from './constants'
import { OwnerDataEraser } from './decorators/owner-data-eraser.decorator'
import type { DeleteUserInput, OwnerDataEraserInterface } from './users.types'

/**
 * Tells whether a discovered provider can erase the data of an owner.
 *
 * @param instance - the instance of a provider marked `@OwnerDataEraser()`
 * @returns `true` when it has the method of the port
 */
const isOwnerDataEraser = (instance: unknown): instance is OwnerDataEraserInterface =>
  typeof instance === 'object' &&
  instance !== null &&
  typeof (instance as Partial<OwnerDataEraserInterface>).eraseOwnerData === 'function'

/**
 * Deletes a user together with everything they own, in one database transaction.
 *
 * The data of each domain is erased by the providers that domain marks `@OwnerDataEraser()`, found through
 * `DiscoveryService`: `core` imports no domain and touches no model but `User`. A failure anywhere rolls everything
 * back. The identity at the identity provider stays, so a later login creates a new, empty user.
 */
@Injectable()
export class UserDeletionService implements OnModuleInit {
  private erasers: OwnerDataEraserInterface[] = []

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OwnershipService) private readonly ownership: OwnershipService,
    @Inject(DiscoveryService) private readonly discovery: DiscoveryService,
  ) {}

  /**
   * Collects the erasers of the domains once the providers exist.
   *
   * @throws Error when a provider marked `@OwnerDataEraser()` does not implement the port: a programming error, so the
   * app does not start rather than delete users whose data it cannot erase
   */
  onModuleInit(): void {
    this.erasers = this.discovery.getProviders({ metadataKey: OwnerDataEraser.KEY }).map(({ instance, name }) => {
      if (!isOwnerDataEraser(instance)) {
        throw new Error(`${String(name)} is marked @OwnerDataEraser() but does not implement eraseOwnerData`)
      }

      return instance
    })
  }

  /**
   * Deletes the user and every row they own, after checking the confirmation.
   *
   * One interactive database transaction: the user is read, the confirmation compared with their email, the erasers of
   * the domains run one after another on the same transaction, and the `User` row goes last. Nothing is deleted unless
   * all of it is.
   *
   * @param userId - the user from the access token
   * @param input - the confirmation the client sent
   * @returns when the user and their data are gone
   * @throws UnauthorizedException when the user no longer exists (the same answer as `GET /api/users/me` and a refresh)
   * @throws ConflictException when the confirmation is not the email of the user
   */
  async delete(userId: string, { confirm }: DeleteUserInput): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } })

        if (!user) {
          throw new UnauthorizedException('Invalid or expired access token')
        }

        if (confirm !== user.email) {
          throw new ConflictException('Confirmation does not match the email of the user')
        }

        const owner = this.ownership.ownerOf(user.id)

        // One after another: an interactive transaction is one connection, which runs one query at a time.
        for (const eraser of this.erasers) {
          await eraser.eraseOwnerData(owner, tx)
        }

        // `delete`, not `deleteMany`: a user gone in the meantime fails (P2025) and rolls everything back.
        await tx.user.delete({ where: { id: user.id } })
      },
      { timeout: USER_DELETION_TIMEOUT_MS },
    )
  }
}
