import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'

import { describeError, isNonEmptyString } from '../../../utils'
import type { Env } from '../../config'

import type { TokenPair, VerifiedAccessToken, VerifiedRefreshToken } from './types'

const ALGORITHM = 'HS256'

type TokenKind = 'access' | 'refresh'

type Claims = { sub?: unknown; exp?: unknown }

/**
 * Issues and verifies the app's own session tokens (ADR 0006). Access and refresh tokens are signed with
 * different secrets, so one is never accepted as the other, and neither is the login checks cookie.
 */
@Injectable()
export class AuthTokensService {
  private readonly logger = new Logger(AuthTokensService.name)
  private readonly secrets: Record<TokenKind, string>
  private readonly accessTtlSeconds: number
  private readonly refreshTtlSeconds: number

  constructor(
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(ConfigService) config: ConfigService<Env, true>,
  ) {
    this.secrets = {
      access: config.get('JWT_ACCESS_SECRET', { infer: true }),
      refresh: config.get('JWT_REFRESH_SECRET', { infer: true }),
    }
    this.accessTtlSeconds = config.get('JWT_ACCESS_TTL_SECONDS', { infer: true })
    this.refreshTtlSeconds = config.get('JWT_REFRESH_TTL_SECONDS', { infer: true })
  }

  /**
   * Without `refreshExpiresAt` the refresh token gets its full lifetime (a login). With it, the token ends
   * when the one it replaces would have (a refresh), so the session cannot be extended forever.
   */
  async issue(userId: string, refreshExpiresAt?: number): Promise<TokenPair> {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: userId },
        { secret: this.secrets.access, algorithm: ALGORITHM, expiresIn: this.accessTtlSeconds },
      ),
      this.signRefresh(userId, refreshExpiresAt),
    ])

    return { accessToken, refreshToken, expiresIn: this.accessTtlSeconds }
  }

  /** Throws `UnauthorizedException` when the token is missing, forged, expired, or not an access token. */
  async verifyAccess(token: string | undefined): Promise<VerifiedAccessToken> {
    const { userId } = await this.verify(token, 'access')

    return { userId }
  }

  /** Throws `UnauthorizedException` when the token is missing, forged, expired, or not a refresh token. */
  verifyRefresh(token: string | undefined): Promise<VerifiedRefreshToken> {
    return this.verify(token, 'refresh')
  }

  private signRefresh(userId: string, expiresAt?: number): Promise<string> {
    const options = { secret: this.secrets.refresh, algorithm: ALGORITHM } as const

    // The library refuses `expiresIn` next to an `exp` in the payload, so the two cases sign differently.
    return expiresAt === undefined
      ? this.jwt.signAsync({ sub: userId }, { ...options, expiresIn: this.refreshTtlSeconds })
      : this.jwt.signAsync({ sub: userId, exp: expiresAt }, options)
  }

  private async verify(token: string | undefined, kind: TokenKind): Promise<VerifiedRefreshToken> {
    if (!token) {
      throw this.reject(kind, 'token is missing')
    }

    let claims: Claims
    try {
      claims = await this.jwt.verifyAsync<Claims>(token, { secret: this.secrets[kind], algorithms: [ALGORITHM] })
    } catch (error) {
      throw this.reject(kind, describeError(error))
    }

    // Tokens are only ever signed with an `exp`: a validly signed one without it is not one of ours.
    const { sub, exp } = claims
    if (!isNonEmptyString(sub) || typeof exp !== 'number') {
      throw this.reject(kind, 'unexpected claims')
    }

    return { userId: sub, expiresAt: exp }
  }

  /** Logs the reason server-side, never the token. The response is the same for every failure. */
  private reject(kind: TokenKind, reason: string): UnauthorizedException {
    this.logger.warn(`${kind} token rejected (${reason})`)
    return new UnauthorizedException(`Invalid or expired ${kind} token`)
  }
}
