import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'

import { UsersService } from '../users/users.service'

import { AuthChecksService } from './auth-checks.service'
import { AuthTokensService } from './auth-tokens.service'
import { AUTH_PROVIDER } from './constants'
import type { AuthProviderInterface, AuthSession, LogoutRequest, StartedLogin, TokenPair } from './types'

/**
 * Ties the login flow together: the provider talks to the IdP, the users service resolves who logged in,
 * the tokens service issues the app's own session.
 */
@Injectable()
export class AuthService {
  constructor(
    @Inject(AUTH_PROVIDER) private readonly provider: AuthProviderInterface,
    @Inject(AuthChecksService) private readonly checks: AuthChecksService,
    @Inject(AuthTokensService) private readonly tokens: AuthTokensService,
    @Inject(UsersService) private readonly users: UsersService,
  ) {}

  async startLogin(): Promise<StartedLogin> {
    const { authorizationUrl, checks } = await this.provider.login()

    return { authorizationUrl, checksToken: await this.checks.sign(checks) }
  }

  /**
   * Finishes a login from the IdP's callback and issues the session. The user is touched last, so a rejected
   * callback (bad cookie, wrong `state`, failed code exchange, no email) never creates or changes one,
   * and never yields a token.
   */
  async completeLogin(callbackParams: URLSearchParams, checksToken?: string): Promise<TokenPair> {
    const checks = await this.checks.verify(checksToken)
    const session = await this.provider.validateSession(callbackParams, checks)
    // The ID token does not always carry the email. The access token is only needed for this one call.
    const email = session.email ?? (await this.userInfoEmail(session))

    const user = await this.users.upsertByExternalSubject({ subject: session.subject, email })

    return this.tokens.issue(user.id)
  }

  /**
   * Swaps a refresh token for a new pair. The new refresh token ends when the old one would have, and the user
   * must still exist: deleting the `User` is the only way to end a session early (the tokens are stateless).
   */
  async refresh(refreshToken?: string): Promise<TokenPair> {
    const { userId, expiresAt } = await this.tokens.verifyRefresh(refreshToken)

    const user = await this.users.findById(userId)
    if (!user) {
      throw new UnauthorizedException('Invalid or expired refresh token')
    }

    return this.tokens.issue(user.id, expiresAt)
  }

  /** Nothing to end on our side (stateless tokens): hands back where the browser must go to end the IdP session. */
  logout(): Promise<LogoutRequest> {
    return this.provider.logout()
  }

  private async userInfoEmail(session: AuthSession): Promise<string> {
    const { email } = await this.provider.getUserInfo(session)

    return email
  }
}
