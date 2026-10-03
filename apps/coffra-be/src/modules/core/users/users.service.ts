import { Inject, Injectable } from '@nestjs/common'

import { AuthSource, PrismaService, type User } from '../../prisma'

import type { UserIdentity } from './users.types'

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /**
   * Finds the user by identity provider identity and creates it on first login. Keeps the email in sync with
   * the provider. Keyed on `(authSource, externalSubject)`, never on email, so accounts are not linked by email.
   */
  upsertByExternalSubject({ subject, email }: UserIdentity): Promise<User> {
    return this.prisma.user.upsert({
      where: { authSource_externalSubject: { authSource: AuthSource.oidc, externalSubject: subject } },
      create: { authSource: AuthSource.oidc, externalSubject: subject, email },
      update: { email },
    })
  }

  /** `null` when the user no longer exists, e.g. it was deleted while its refresh token was still valid. */
  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } })
  }
}
