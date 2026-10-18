import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'

import { omitUndefined } from '../../../utils'
import { type Owner, OwnershipService } from '../../core'
import { type Account, isPrismaError, PrismaErrorCode, PrismaService } from '../../prisma'

import { toAccountView } from './accounts.mapper'
import type { AccountView, CreateAccountInput, UpdateAccountInput } from './accounts.types'

const RESOURCE = 'Account'

@Injectable()
export class AccountsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OwnershipService) private readonly ownership: OwnershipService,
  ) {}

  /** The owner's accounts by name; the id keeps the order stable, names are not unique. */
  async list(owner: Owner): Promise<AccountView[]> {
    const rows = await this.prisma.account.findMany({
      where: this.ownership.scope(owner),
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    })

    return rows.map(toAccountView)
  }

  async findOne(owner: Owner, id: string): Promise<AccountView> {
    return toAccountView(await this.findOwned(owner, id))
  }

  async create(owner: Owner, { name, type, currency, openingBalance }: CreateAccountInput): Promise<AccountView> {
    try {
      const row = await this.prisma.account.create({
        data: { name, type, currency, ...omitUndefined({ openingBalance }), ...this.ownership.ownerData(owner) },
      })

      return toAccountView(row)
    } catch (error) {
      // The owner is the only foreign key of an account: the user was deleted while the access token was still
      // valid. The same answer as `GET /api/users/me` and a refresh give then.
      if (isPrismaError(error, PrismaErrorCode.ForeignKeyViolation)) {
        throw new UnauthorizedException('Invalid or expired access token')
      }

      throw error
    }
  }

  /** The currency is not in the input: it is set on create only. */
  async update(owner: Owner, id: string, { name, type, openingBalance }: UpdateAccountInput): Promise<AccountView> {
    await this.findOwned(owner, id)

    try {
      const row = await this.prisma.account.update({
        where: { id, ...this.ownership.scope(owner) },
        data: omitUndefined({ name, type, openingBalance }),
      })

      return toAccountView(row)
    } catch (error) {
      this.throwIfGone(error)
      throw error
    }
  }

  async remove(owner: Owner, id: string): Promise<void> {
    await this.findOwned(owner, id)

    try {
      await this.prisma.account.delete({ where: { id, ...this.ownership.scope(owner) } })
    } catch (error) {
      // `Restrict` on the transactions of the account: the database decides, so a transaction created a moment ago
      // cannot slip through a check made before the delete.
      if (isPrismaError(error, PrismaErrorCode.ForeignKeyViolation)) {
        throw new ConflictException('Account has transactions and cannot be deleted')
      }

      this.throwIfGone(error)
      throw error
    }
  }

  private async findOwned(owner: Owner, id: string): Promise<Account> {
    const row = await this.prisma.account.findFirst({ where: { id, ...this.ownership.scope(owner) } })

    return this.ownership.orNotFound(row, RESOURCE)
  }

  /** The row was deleted between the scoped read and the write: the same 404 as an account that never existed. */
  private throwIfGone(error: unknown): void {
    if (isPrismaError(error, PrismaErrorCode.RecordNotFound)) {
      this.ownership.orNotFound(null, RESOURCE)
    }
  }
}
