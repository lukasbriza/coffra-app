import { Controller, Get, HttpStatus, Inject, Redirect, Req, Res, type HttpRedirectResponse } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  ApiFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'
import type { CookieOptions, Request, Response } from 'express'

import { GLOBAL_PREFIX } from '../../../app.setup'
import { type Env, NodeEnv } from '../../config'

import { AUTH_CHECKS_COOKIE, AUTH_CHECKS_TTL_SECONDS } from './auth.constants'
import { AuthService } from './auth.service'

// T11 marks both routes `@Public()` once the global guard exists.
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  /** Shared by setting and clearing the cookie: a cookie is only cleared by the same `path`. */
  private readonly cookieOptions: CookieOptions

  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(ConfigService) config: ConfigService<Env, true>,
  ) {
    this.cookieOptions = {
      httpOnly: true,
      // Not `strict`: the callback is a cross-site top-level navigation from the IdP and must carry the cookie.
      sameSite: 'lax',
      secure: config.get('NODE_ENV', { infer: true }) === NodeEnv.Production,
      path: `/${GLOBAL_PREFIX}/auth`,
    }
  }

  @Get('login')
  @Redirect()
  @ApiOperation({ summary: 'Start the OIDC login (authorization code + PKCE) and redirect to the identity provider' })
  @ApiFoundResponse({ description: 'Redirect to the identity provider, sets the short-lived login checks cookie' })
  @ApiServiceUnavailableResponse({ description: 'The identity provider is unavailable' })
  async login(@Res({ passthrough: true }) res: Response): Promise<HttpRedirectResponse> {
    const { authorizationUrl, checksToken } = await this.auth.startLogin()

    res.cookie(AUTH_CHECKS_COOKIE, checksToken, { ...this.cookieOptions, maxAge: AUTH_CHECKS_TTL_SECONDS * 1000 })
    res.setHeader('Cache-Control', 'no-store')

    return { url: authorizationUrl, statusCode: HttpStatus.FOUND }
  }

  // The path must stay `/api/auth/callback`: it is the redirect URI registered at the identity provider.
  @Get('callback')
  @ApiOperation({ summary: 'Finish the OIDC login: validate the response, exchange the code, resolve the user' })
  @ApiOkResponse({
    description: 'The resolved user. Temporary body, T10 replaces it with the issued tokens',
    schema: { type: 'object', properties: { userId: { type: 'string' }, email: { type: 'string' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or expired login cookie, or the identity provider response is invalid',
  })
  @ApiServiceUnavailableResponse({ description: 'The identity provider is unavailable' })
  async callback(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ userId: string; email: string }> {
    res.setHeader('Cache-Control', 'no-store')
    // The checks are single-use: dropped on every callback, whether it succeeds or not.
    res.clearCookie(AUTH_CHECKS_COOKIE, this.cookieOptions)

    // Read from the URL, not `req.query`: the provider needs every parameter as sent (`iss`, `error`, ...), once.
    const callbackParams = new URL(req.originalUrl, 'http://localhost').searchParams
    const cookies = req.cookies as Record<string, unknown> | undefined
    const checksToken = cookies?.[AUTH_CHECKS_COOKIE]

    const user = await this.auth.completeLogin(
      callbackParams,
      typeof checksToken === 'string' ? checksToken : undefined,
    )

    return { userId: user.id, email: user.email }
  }
}
