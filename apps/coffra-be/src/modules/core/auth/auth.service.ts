import { Inject, Injectable } from '@nestjs/common'

import type { User } from '../../prisma'
import { UsersService } from '../users/users.service'

import { AuthChecksService } from './auth-checks.service'
import { AUTH_PROVIDER } from './auth.constants'
import type { AuthProviderInterface, AuthSession, StartedLogin } from './types'

/** Ties the login flow together: the provider talks to the IdP, the users service resolves who logged in. */
@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_PROVIDER) private readonly provider: AuthProviderInterface,
    @Inject(AuthChecksService) private readonly checks: AuthChecksService,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  async startLogin(): Promise<StartedLogin> {
    const { authorizationUrl, checks } = await this.provider.login()

    return { authorizationUrl, checksToken: await this.checks.sign(checks) }
  }

  /**
   * Finishes a login from the IdP's callback. The user is touched last, so a rejected callback (bad cookie,
   * wrong `state`, failed code exchange, no email) never creates or changes one.
   */
  async completeLogin(callbackParams: URLSearchParams, checksToken?: string): Promise<User> {
    const checks = await this.checks.verify(checksToken)
    const session = await this.provider.validateSession(callbackParams, checks)
    // The ID token does not always carry the email. The access token is only needed for this one call.
    const email = session.email ?? (await this.userInfoEmail(session))

    return this.users.upsertByExternalSubject({ subject: session.subject, email })
  }

  private async userInfoEmail(session: AuthSession): Promise<string> {
    const { email } = await this.provider.getUserInfo(session)

    return email
  }
}
