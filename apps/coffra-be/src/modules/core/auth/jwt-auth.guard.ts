import type { CanActivate, ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import type { Response } from 'express'

import { extractBearerToken } from '../../../utils'

import type { AuthTokensService } from './auth-tokens.service'
import { IS_PUBLIC_KEY } from './constants'
import type { AuthenticatedRequest } from './types'

/**
 * Guard that lets a request through only with a valid access token, unless the route is `@Public()`.
 *
 * Made global in `main.ts` (`app.useGlobalGuards(new JwtAuthGuard(...))`), so every route is protected by default.
 * Stateless on purpose: the token is checked, the database is not, so the access token of a deleted user lives until
 * it expires. Only ever verifies access tokens, never refresh tokens.
 *
 * Built by hand, not by Nest, so it is no provider and has no `@Injectable()` / `@Inject()`.
 */
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: AuthTokensService,
  ) {}

  /**
   * Decides whether a request may reach its route.
   *
   * A valid token sets `request.auth` with the id of the user. A public route is let through without reading the
   * header at all, so refresh and logout work for a client whose access token has expired.
   *
   * @param context - the request being guarded
   * @returns `true` when the route is public or the access token is valid
   * @throws UnauthorizedException when the token is missing, forged, expired or not an access token; the response then
   * carries `WWW-Authenticate: Bearer`
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) {
      // The header is not even read: refresh and logout must work for a client whose access token has expired.
      return true
    }

    const http = context.switchToHttp()
    const request = http.getRequest<AuthenticatedRequest>()

    try {
      request.auth = await this.tokens.verifyAccess(extractBearerToken(request.headers.authorization))
    } catch (error) {
      // RFC 6750 §3. Only the guard sets it, so it tells a rejection here from a 401 the route itself answered.
      http.getResponse<Response>().setHeader('WWW-Authenticate', 'Bearer')
      throw error
    }

    return true
  }
}
