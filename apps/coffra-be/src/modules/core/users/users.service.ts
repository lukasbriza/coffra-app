import { Inject, Injectable } from '@nestjs/common'

import { AuthSource, PrismaService, type User } from '../../prisma'

import type { UserIdentity } from './users.types'

/** The users of the app: created on the first login, found by their identity at the identity provider. */
@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Finds the user by identity at the identity provider and creates it on the first login.
   *
   * Keeps the email in sync with the provider. Keyed on `(authSource, externalSubject)`, never on email, so accounts
   * are not linked by email.
   *
   * @param identity - the `sub` and the email the provider asserted
   * @returns the stored user
   */
  upsertByExternalSubject({ subject, email }: UserIdentity): Promise<User> {
    return this.prisma.user.upsert({
      where: { authSource_externalSubject: { authSource: AuthSource.oidc, externalSubject: subject } },
      create: { authSource: AuthSource.oidc, externalSubject: subject, email },
      update: { email },
    })
  }

  /**
   * Finds a user by id.
   *
   * @param id - the id of the user (`User.id`)
   * @returns the user, or `null` when it no longer exists, e.g. it was deleted while its refresh token was still valid
   */
  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } })
  }
}
