import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'

import { describeError, isNonEmptyString } from '../../../utils'
import type { Env } from '../../config'

import { AUTH_CHECKS_TTL_SECONDS } from './constants'
import type { AuthChecks } from './types'

const ALGORITHM = 'HS256'

/**
 * Seals the login checks into a short-lived signed token for the cookie (ADR 0009). Signed with its own secret,
 * so it can never be taken for an access or a refresh token.
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

  sign({ state, nonce, codeVerifier }: AuthChecks): Promise<string> {
    return this.jwt.signAsync(
      { state, nonce, codeVerifier },
      { secret: this.secret, algorithm: ALGORITHM, expiresIn: AUTH_CHECKS_TTL_SECONDS },
    )
  }

  /** Throws `UnauthorizedException` when the token is missing, forged, expired or has an unexpected shape. */
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

  /** Logs the reason server-side, never the token. The response only says to start the login again. */
  private reject(reason: string): UnauthorizedException {
    this.logger.warn(reason)
    return new UnauthorizedException('Login session missing or expired')
  }
}
