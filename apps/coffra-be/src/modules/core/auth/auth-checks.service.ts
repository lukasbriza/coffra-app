import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'

import { describeError, isNonEmptyString } from '../../../utils'
import type { Env } from '../../config'

import { AUTH_CHECKS_TTL_SECONDS } from './constants'
import type { AuthChecks } from './types'

/** The only signing algorithm accepted for the login checks token. */
const ALGORITHM = 'HS256'

/**
 * Seals the login checks into a short-lived signed token for the cookie.
 *
 * Signed with its own secret, so it can never be taken for an access or a refresh token.
 */
@Injectable()
export class AuthChecksService {
  private readonly logger = new Logger(AuthChecksService.name)
  private readonly secret: string

  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ConfigService) config: ConfigService<Env, true>,
  ) {
    this.secret = config.get('AUTH_CHECKS_SECRET', { infer: true })
  }

  /**
   * Signs the login checks into a token that lives for `AUTH_CHECKS_TTL_SECONDS`.
   *
   * @param checks - the values the callback has to verify
   * @returns the signed token to put into the cookie
   */
  sign({ state, nonce, codeVerifier }: AuthChecks): Promise<string> {
    return this.jwt.signAsync(
      { state, nonce, codeVerifier },
      { secret: this.secret, algorithm: ALGORITHM, expiresIn: AUTH_CHECKS_TTL_SECONDS },
    )
  }

  /**
   * Verifies the token from the cookie and returns the checks inside.
   *
   * @param token - the value of the login checks cookie, `undefined` when the cookie is absent
   * @returns the login checks
   * @throws UnauthorizedException when the token is missing, forged, expired or has an unexpected shape
   */
  async verify(token: string | undefined): Promise<AuthChecks> {
    if (!token) {
      throw this.reject('Login checks cookie is missing')
    }

    let payload: Partial<Record<keyof AuthChecks, unknown>>
    try {
      payload = await this.jwt.verifyAsync<typeof payload>(token, { secret: this.secret, algorithms: [ALGORITHM] })
    } catch (error) {
      throw this.reject(`Login checks cookie rejected (${describeError(error)})`)
    }

    const { state, nonce, codeVerifier } = payload
    if (!isNonEmptyString(state) || !isNonEmptyString(nonce) || !isNonEmptyString(codeVerifier)) {
      throw this.reject('Login checks cookie has an unexpected shape')
    }

    return { state, nonce, codeVerifier }
  }

  /**
   * Builds the answer to a rejected cookie.
   *
   * Logs the reason server-side, never the token. The response only says to start the login again.
   *
   * @param reason - why the cookie was rejected, for the log
   * @returns the exception to throw
   */
  private reject(reason: string): UnauthorizedException {
    this.logger.warn(reason)
    return new UnauthorizedException('Login session missing or expired')
  }
}
