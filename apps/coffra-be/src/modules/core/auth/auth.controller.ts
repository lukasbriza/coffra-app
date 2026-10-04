import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Redirect,
  Req,
  Res,
  type HttpRedirectResponse,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  ApiBadRequestResponse,
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

import { AuthService } from './auth.service'
import { AUTH_CHECKS_COOKIE, AUTH_CHECKS_TTL_SECONDS } from './constants'
import { Public } from './decorators/public.decorator'
import { LogoutResponseDto } from './dto/logout-response.dto'
import { RefreshTokenDto } from './dto/refresh-token.dto'
import { TokenPairDto } from './dto/token-pair.dto'
import type { LogoutRequest, TokenPair } from './types'

// `@Public()` goes on each method, not on the class: a route added here later stays protected until someone
// opens it on purpose. Login and callback precede any token, refresh and logout must work with an expired one.
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

  @Public()
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
  @Public()
  @Get('callback')
  @ApiOperation({ summary: 'Finish the OIDC login: validate the response, exchange the code, issue the session' })
  @ApiOkResponse({ description: 'The access and refresh token of the user who logged in', type: TokenPairDto })
  @ApiUnauthorizedResponse({
    description: 'Missing or expired login cookie, or the identity provider response is invalid',
  })
  @ApiServiceUnavailableResponse({ description: 'The identity provider is unavailable' })
  async callback(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<TokenPair> {
    res.setHeader('Cache-Control', 'no-store')
    // The checks are single-use: dropped on every callback, whether it succeeds or not.
    res.clearCookie(AUTH_CHECKS_COOKIE, this.cookieOptions)

    // Read from the URL, not `req.query`: the provider needs every parameter as sent (`iss`, `error`, ...), once.
    const callbackParams = new URL(req.originalUrl, 'http://localhost').searchParams
    const cookies = req.cookies as Record<string, unknown> | undefined
    const checksToken = cookies?.[AUTH_CHECKS_COOKIE]

    return this.auth.completeLogin(callbackParams, typeof checksToken === 'string' ? checksToken : undefined)
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Swap a refresh token for a new token pair',
    description:
      'The new refresh token ends when the old one would have, so a session lasts at most `JWT_REFRESH_TTL_SECONDS` from the login. The old refresh token is not revoked.',
  })
  @ApiOkResponse({ description: 'A new access and refresh token', type: TokenPairDto })
  @ApiBadRequestResponse({ description: 'The body has no `refreshToken` string' })
  @ApiUnauthorizedResponse({
    description: 'The refresh token is missing, invalid, expired, not a refresh token, or its user no longer exists',
  })
  refresh(@Body() { refreshToken }: RefreshTokenDto): Promise<TokenPair> {
    return this.auth.refresh(refreshToken)
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get the URL that ends the session at the identity provider',
    description:
      'Stateless: nothing changes on the server and no token is needed. The client must discard both tokens (the refresh token stays valid until it expires) and navigate the browser to `endSessionUrl`, otherwise the session at the identity provider survives and the next login needs no password.',
  })
  @ApiOkResponse({ description: 'Where to send the browser', type: LogoutResponseDto })
  @ApiServiceUnavailableResponse({ description: 'The identity provider is unavailable' })
  logout(): Promise<LogoutRequest> {
    return this.auth.logout()
  }
}
