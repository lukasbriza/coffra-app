import type { CanActivate, ExecutionContext } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import type { Response } from 'express'

import { extractBearerToken } from '../../../utils'

import type { AuthTokensService } from './auth-tokens.service'
import { IS_PUBLIC_KEY } from './constants'
import type { AuthenticatedRequest } from './types'

/**
 * Made global in `main.ts` (`app.useGlobalGuards(new JwtAuthGuard(...))`): every route needs a valid access
 * token unless it is `@Public()`. Stateless on purpose (ADR 0006, 0010): the token is checked, the database is
 * not, so a deleted user's access token lives until it expires. Only ever verifies access tokens, never refresh tokens.
 *
 * Built by hand, not by Nest, so it is no provider and has no `@Injectable()` / `@Inject()`.
 */
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: AuthTokensService,
  ) {}

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
