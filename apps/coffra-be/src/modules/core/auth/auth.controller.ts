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

/**
 * HTTP layer of the login flow under `/api/auth`: login, callback, refresh and logout.
 *
 * `@Public()` goes on each method, not on the class: a route added here later stays protected until someone opens it
 * on purpose. Login and callback precede any token; refresh and logout must work with an expired one.
 */
@Controller('auth')
// Swagger
@ApiTags('auth')
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

  /**
   * `GET /api/auth/login`: starts the login and redirects the browser to the identity provider.
   *
   * Sets the short-lived cookie that carries the login checks to the callback.
   *
   * @param res - the response, to set the cookie and the cache header
   * @returns the redirect to the identity provider
   * @throws ServiceUnavailableException when the identity provider is unavailable
   */
  @Public()
  @Get('login')
  @Redirect()
  // Swagger
  @ApiOperation({ summary: 'Start the OIDC login (authorization code + PKCE) and redirect to the identity provider' })
  @ApiFoundResponse({ description: 'Redirect to the identity provider, sets the short-lived login checks cookie' })
  @ApiServiceUnavailableResponse({ description: 'The identity provider is unavailable' })
  async login(@Res({ passthrough: true }) res: Response): Promise<HttpRedirectResponse> {
    const { authorizationUrl, checksToken } = await this.auth.startLogin()

    res.cookie(AUTH_CHECKS_COOKIE, checksToken, { ...this.cookieOptions, maxAge: AUTH_CHECKS_TTL_SECONDS * 1000 })
    res.setHeader('Cache-Control', 'no-store')

    return { url: authorizationUrl, statusCode: HttpStatus.FOUND }
  }

  /**
   * `GET /api/auth/callback`: finishes the login the identity provider sends the browser back from.
   *
   * The path must stay `/api/auth/callback`: it is the redirect URI registered at the identity provider.
   *
   * @param req - the request, for the callback parameters and the login checks cookie
   * @param res - the response, to clear the single-use cookie and set the cache header
   * @returns the access and refresh token of the user who logged in
   * @throws UnauthorizedException when the login cookie is missing or expired, or the provider response is invalid
   * @throws ServiceUnavailableException when the identity provider is unavailable
   */
  @Public()
  @Get('callback')
  // Swagger
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

  /**
   * `POST /api/auth/refresh`: swaps a refresh token for a new token pair.
   *
   * @param body - the refresh token, in the body
   * @returns a new access and refresh token
   * @throws UnauthorizedException when the refresh token is missing, invalid, expired, not a refresh token, or its user
   * no longer exists
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  // Swagger
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

  /**
   * `POST /api/auth/logout`: returns where the browser has to go to end the session at the identity provider.
   *
   * Stateless: nothing changes on the server and no token is needed. The client discards both tokens and navigates
   * there.
   *
   * @returns the end-session URL, `null` when the provider has none
   * @throws ServiceUnavailableException when the identity provider is unavailable
   */
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  // Swagger
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
