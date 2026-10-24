import { Inject, Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as client from 'openid-client'

import { describeError, stringOrUndefined } from '../../../utils'
import { type Env, NodeEnv } from '../../config'

import { OIDC_SCOPE } from './constants'
import type { AuthChecks, AuthProviderInterface, AuthSession, AuthUserInfo, LoginRequest, LogoutRequest } from './types'

/**
 * Generic OpenID Connect client: authorization code flow with PKCE against any compliant identity provider, not only
 * Keycloak.
 *
 * Stateless: the values to verify in the callback are handed back to the caller, which decides where to keep them. The
 * provider is discovered lazily on first use and a failed discovery is not cached.
 */
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

  /**
   * Starts a login: builds the authorization URL with a PKCE challenge, `state` and `nonce`.
   *
   * @returns the URL to send the browser to and the values to verify in the callback
   * @throws ServiceUnavailableException when the identity provider is unavailable
   */
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

  /**
   * Handles the callback of the identity provider: exchanges the code and validates the ID token.
   *
   * The `redirect_uri` comes from the configuration, not from the request: behind a reverse proxy the protocol and host
   * of the request differ from what is registered at the identity provider.
   *
   * @param callbackParams - the query parameters of the callback, as sent
   * @param checks - the values saved at the login: `state`, `nonce` and the PKCE verifier
   * @returns who logged in, with the access token for a later call to `getUserInfo`
   * @throws UnauthorizedException when the response is not valid; the reason is only logged
   * @throws ServiceUnavailableException when the identity provider is unavailable
   */
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

  /**
   * Fetches the profile of the user from the userinfo endpoint.
   *
   * The `sub` of the response must equal the one from the ID token.
   *
   * @param session - the session returned by `validateSession`
   * @returns the profile; the email falls back to the one from the ID token
   * @throws UnauthorizedException when the request is rejected or the provider returns no email
   * @throws ServiceUnavailableException when the identity provider is unavailable
   */
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

  /**
   * Builds the URL that ends the session at the identity provider.
   *
   * It carries only the `client_id`: there is no `id_token_hint` (the ID token is not kept), so the provider asks the
   * user to confirm, and no `post_logout_redirect_uri` (there is no frontend to return to yet).
   *
   * @returns the URL, or `null` when the provider has no end-session endpoint (it is optional in discovery)
   * @throws ServiceUnavailableException when the identity provider is unavailable
   */
  async logout(): Promise<LogoutRequest> {
    const configuration = await this.getConfiguration()

    // `end_session_endpoint` is optional in discovery: a generic OIDC provider may not have one.
    if (!configuration.serverMetadata().end_session_endpoint) {
      return { endSessionUrl: null }
    }

    return { endSessionUrl: client.buildEndSessionUrl(configuration).href }
  }

  /**
   * Returns the discovered configuration of the provider, discovering it on the first call.
   *
   * @returns the configuration, cached after a successful discovery
   * @throws ServiceUnavailableException when the discovery fails
   */
  private getConfiguration(): Promise<client.Configuration> {
    this.configuration ??= this.discover()
    return this.configuration
  }

  /**
   * Runs the discovery of the identity provider.
   *
   * A failed discovery is not cached, or one blip would block logins until restart.
   *
   * @returns the configuration of the provider
   * @throws ServiceUnavailableException when the provider cannot be reached or answers badly
   */
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

  /**
   * Builds the answer to a rejected response.
   *
   * Logs the reason server-side and returns a generic 401, so nothing from the library or the identity provider leaks.
   *
   * @param reason - why the response was rejected, for the log
   * @param error - the underlying error, if there was one
   * @returns the exception to throw
   */
  private reject(reason: string, error?: unknown): UnauthorizedException {
    this.logger.warn(error === undefined ? reason : `${reason} (${describeError(error)})`)
    return new UnauthorizedException('Authentication failed')
  }
}
