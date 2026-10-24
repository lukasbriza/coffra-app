import { Inject, Injectable, Logger, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'

import { describeError, isNonEmptyString } from '../../../utils'
import type { Env } from '../../config'

import type { TokenPair, VerifiedAccessToken, VerifiedRefreshToken } from './types'

/** The only signing algorithm accepted for the session tokens. */
const ALGORITHM = 'HS256'

/** The two kinds of session token; each is signed with its own secret. */
type TokenKind = 'access' | 'refresh'

/**
 * The claims read from a token before they are trusted.
 *
 * @property sub - id of the user the token was issued to
 * @property exp - expiry as a Unix time in seconds
 */
type Claims = { sub?: unknown; exp?: unknown }

/**
 * Issues and verifies the session tokens of the app itself.
 *
 * Access and refresh tokens are signed with different secrets, so one is never accepted as the other, and neither is
 * the login checks cookie.
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
   * Issues a new pair of tokens for a user.
   *
   * Without `refreshExpiresAt` the refresh token gets its full lifetime (a login). With it, the token ends when the one
   * it replaces would have (a refresh), so the session cannot be extended forever.
   *
   * @param userId - the user the tokens are issued to (`User.id`)
   * @param refreshExpiresAt - expiry of the refresh token being replaced, as a Unix time in seconds
   * @returns the access token, the refresh token and the lifetime of the access token
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

  /**
   * Verifies an access token.
   *
   * @param token - the token from the `Authorization` header, `undefined` when there is none
   * @returns who the token was issued to
   * @throws UnauthorizedException when the token is missing, forged, expired, or not an access token
   */
  async verifyAccess(token: string | undefined): Promise<VerifiedAccessToken> {
    const { userId } = await this.verify(token, 'access')

    return { userId }
  }

  /**
   * Verifies a refresh token.
   *
   * @param token - the refresh token sent by the client, `undefined` when there is none
   * @returns who the token was issued to and when it expires
   * @throws UnauthorizedException when the token is missing, forged, expired, or not a refresh token
   */
  verifyRefresh(token: string | undefined): Promise<VerifiedRefreshToken> {
    return this.verify(token, 'refresh')
  }

  /**
   * Signs a refresh token.
   *
   * @param userId - the user the token is issued to
   * @param expiresAt - expiry to keep, as a Unix time in seconds; the full lifetime when left out
   * @returns the signed token
   */
  private signRefresh(userId: string, expiresAt?: number): Promise<string> {
    const options = { secret: this.secrets.refresh, algorithm: ALGORITHM } as const

    // The library refuses `expiresIn` next to an `exp` in the payload, so the two cases sign differently.
    return expiresAt === undefined
      ? this.jwt.signAsync({ sub: userId }, { ...options, expiresIn: this.refreshTtlSeconds })
      : this.jwt.signAsync({ sub: userId, exp: expiresAt }, options)
  }

  /**
   * Verifies a token of the given kind and reads its claims.
   *
   * @param token - the token to verify
   * @param kind - which secret to verify it with
   * @returns the user and the expiry from the claims
   * @throws UnauthorizedException when the token is missing, forged, expired, or has unexpected claims
   */
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

  /**
   * Builds the answer to a rejected token.
   *
   * Logs the reason server-side, never the token. The response is the same for every failure.
   *
   * @param kind - the kind of token that was rejected
   * @param reason - why it was rejected, for the log
   * @returns the exception to throw
   */
  private reject(kind: TokenKind, reason: string): UnauthorizedException {
    this.logger.warn(`${kind} token rejected (${reason})`)
    return new UnauthorizedException(`Invalid or expired ${kind} token`)
  }
}
