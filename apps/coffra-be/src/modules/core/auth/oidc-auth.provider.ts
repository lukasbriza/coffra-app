import { Inject, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as client from 'openid-client'

import { describeError, stringOrUndefined } from '../../../utils'
import { type Env, NodeEnv } from '../../config'

import { OIDC_SCOPE } from './auth.constants'
import type { AuthChecks, AuthProviderInterface, AuthSession, AuthUserInfo, LoginRequest, LogoutRequest } from './types'

/** Generic OIDC client (any compliant IdP, not only Keycloak). See ADR 0008 for the library choice. */
@Injectable()
export class OidcAuthProvider implements AuthProviderInterface {
  private readonly logger = new Logger(OidcAuthProvider.name)
  private readonly issuerUrl: URL
  private readonly clientId: string
  private readonly clientSecret: string
  private readonly redirectUri: string
  /** Plain `http:` is accepted only outside production (the dev Keycloak). `env.validation` rejects it in production. */
  private readonly allowInsecureRequests: boolean
  /** Discovery runs on first use, so startup and tests do not depend on a reachable IdP. */
  private configuration?: Promise<client.Configuration> | undefined

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.issuerUrl = new URL(config.get('OIDC_ISSUER_URL', { infer: true }))
    this.clientId = config.get('OIDC_CLIENT_ID', { infer: true })
    this.clientSecret = config.get('OIDC_CLIENT_SECRET', { infer: true })
    this.redirectUri = config.get('OIDC_REDIRECT_URI', { infer: true })
    this.allowInsecureRequests =
      this.issuerUrl.protocol === 'http:' && config.get('NODE_ENV', { infer: true }) !== NodeEnv.Production
  }

  async login(): Promise<LoginRequest> {
    const configuration = await this.getConfiguration()

    const codeVerifier = client.randomPKCECodeVerifier()
    const state = client.randomState()
    const nonce = client.randomNonce()

    const url = client.buildAuthorizationUrl(configuration, {
      redirect_uri: this.redirectUri,
      scope: OIDC_SCOPE,
      code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
      code_challenge_method: 'S256',
      state,
      nonce,
    })

    return { authorizationUrl: url.href, checks: { state, nonce, codeVerifier } }
  }

  async validateSession(callbackParams: URLSearchParams, checks: AuthChecks): Promise<AuthSession> {
    const configuration = await this.getConfiguration()

    // Built from the configured redirect URI, not from the request: behind a reverse proxy
    // the request's protocol and host differ from what is registered at the IdP.
    const currentUrl = new URL(this.redirectUri)
    currentUrl.search = callbackParams.toString()

    try {
      const tokens = await client.authorizationCodeGrant(configuration, currentUrl, {
        pkceCodeVerifier: checks.codeVerifier,
        expectedState: checks.state,
        expectedNonce: checks.nonce,
        idTokenExpected: true,
      })
      const claims = tokens.claims()

      if (!claims) {
        throw new Error('ID token missing')
      }

      return { subject: claims.sub, email: stringOrUndefined(claims.email), accessToken: tokens.access_token }
    } catch (error) {
      throw this.reject('Authorization response rejected', error)
    }
  }

  async getUserInfo(session: AuthSession): Promise<AuthUserInfo> {
    const configuration = await this.getConfiguration()

    let info: client.UserInfoResponse
    try {
      // Verifies that the userinfo `sub` equals the one from the ID token.
      info = await client.fetchUserInfo(configuration, session.accessToken, session.subject)
    } catch (error) {
      throw this.reject('Userinfo request rejected', error)
    }

    const email = stringOrUndefined(info.email) ?? session.email
    if (!email) {
      throw this.reject('Identity provider returned no email')
    }

    return {
      subject: info.sub,
      email,
      emailVerified: typeof info.email_verified === 'boolean' ? info.email_verified : undefined,
      name: stringOrUndefined(info.name),
    }
  }

  async logout(): Promise<LogoutRequest> {
    const configuration = await this.getConfiguration()

    // `end_session_endpoint` is optional in discovery: a generic OIDC provider may not have one.
    if (!configuration.serverMetadata().end_session_endpoint) {
      return { endSessionUrl: null }
    }

    // Only `client_id`, which the library adds. No `id_token_hint`: the ID token is not kept (ADR 0006), so the
    // IdP asks the user to confirm. No `post_logout_redirect_uri`: there is no frontend to return to yet.
    return { endSessionUrl: client.buildEndSessionUrl(configuration).href }
  }

  private getConfiguration(): Promise<client.Configuration> {
    this.configuration ??= this.discover()
    return this.configuration
  }

  private async discover(): Promise<client.Configuration> {
    try {
      return await client.discovery(
        this.issuerUrl,
        this.clientId,
        this.clientSecret,
        undefined,
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- dev Keycloak runs on http, see ADR 0008
        this.allowInsecureRequests ? { execute: [client.allowInsecureRequests] } : undefined,
      )
    } catch (error) {
      // A failed discovery must not stay cached, or one blip would block logins until restart.
      this.configuration = undefined
      this.logger.error(`OIDC discovery failed (${describeError(error)})`)
      throw new ServiceUnavailableException('Identity provider is unavailable')
    }
  }

  /** Logs the reason server-side and returns a generic 401 so nothing from the library or the IdP leaks. */
  private reject(reason: string, error?: unknown): UnauthorizedException {
    this.logger.warn(error === undefined ? reason : `${reason} (${describeError(error)})`)
    return new UnauthorizedException('Authentication failed')
  }
}
