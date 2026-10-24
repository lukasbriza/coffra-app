import type { Request } from 'express'

/**
 * Values the caller must keep between `login` and the callback.
 *
 * The provider is stateless: where they are stored (e.g. a short-lived signed cookie) is the caller's decision.
 *
 * @property state - random value that ties the callback to the login that started it
 * @property nonce - random value bound into the ID token and checked against it
 * @property codeVerifier - PKCE secret whose hash was sent with the authorization request
 */
export type AuthChecks = {
  state: string
  nonce: string
  codeVerifier: string
}

/**
 * A login the provider has prepared.
 *
 * @property authorizationUrl - where to redirect the browser
 * @property checks - the values to keep until the callback
 */
export type LoginRequest = {
  authorizationUrl: string
  checks: AuthChecks
}

/**
 * A login the app has started.
 *
 * @property authorizationUrl - where to send the browser
 * @property checksToken - the signed token with the login checks, for the cookie
 */
export type StartedLogin = {
  authorizationUrl: string
  checksToken: string
}

/**
 * The session the app issues after a login: its own access and refresh token.
 *
 * @property accessToken - short-lived JWT for the `Authorization: Bearer` header
 * @property refreshToken - JWT for the refresh endpoint only
 * @property expiresIn - lifetime of the access token in seconds; the client plans its refresh by it
 */
export type TokenPair = {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

/**
 * A verified access token.
 *
 * @property userId - the user the token was issued to (`User.id`)
 */
export type VerifiedAccessToken = {
  userId: string
}

/**
 * A verified refresh token.
 *
 * @property expiresAt - expiry as the JWT `exp` in seconds; it is handed on to the next refresh token, so the session
 * has a fixed end
 */
export type VerifiedRefreshToken = VerifiedAccessToken & {
  expiresAt: number
}

/**
 * The request after `JwtAuthGuard`.
 *
 * @property auth - who the access token was issued to; set on every route that is not `@Public()`
 */
export type AuthenticatedRequest = Request & { auth?: VerifiedAccessToken }

/**
 * Where to send the browser to end the session at the identity provider.
 *
 * @property endSessionUrl - the URL, or `null` when the provider does not advertise an end-session endpoint (it is
 * optional in OIDC discovery)
 */
export type LogoutRequest = {
  endSessionUrl: string | null
}

/**
 * What the identity provider told the app about a finished login.
 *
 * @property subject - stable user id at the identity provider (OIDC `sub`), maps to `User.externalSubject`
 * @property email - taken from the ID token when present; use `getUserInfo` to obtain it otherwise
 * @property accessToken - only for `getUserInfo`; the caller drops it afterwards, the app issues its own tokens
 */
export type AuthSession = {
  subject: string
  email?: string | undefined
  accessToken: string
}

/**
 * The profile of a user at the identity provider.
 *
 * @property subject - stable user id at the identity provider (OIDC `sub`)
 * @property email - email address of the user
 * @property emailVerified - whether the provider has verified the email; `undefined` when it does not say
 * @property name - display name, when the provider has one
 */
export type AuthUserInfo = {
  subject: string
  email: string
  emailVerified?: boolean | undefined
  name?: string | undefined
}

/**
 * Port of the authentication: how the app logs a user in through an identity provider.
 *
 * Callers depend on this interface (the `AUTH_PROVIDER` token), never on a concrete provider class.
 */
export type AuthProviderInterface = {
  /**
   * Starts a login: builds the URL to send the browser to, plus the values to verify in the callback.
   *
   * @returns the authorization URL and the login checks
   */
  login(): Promise<LoginRequest>
  /**
   * Validates the response of the identity provider to a login (for OIDC: exchanges the code and verifies the ID
   * token).
   *
   * Takes the callback query, not the request URL, so a reverse proxy cannot skew `redirect_uri`.
   *
   * @param callbackParams - the query parameters of the callback
   * @param checks - the values saved at the login
   * @returns who logged in
   * @throws UnauthorizedException when the response is not valid
   */
  validateSession(callbackParams: URLSearchParams, checks: AuthChecks): Promise<AuthSession>
  /**
   * Fetches the profile from the identity provider.
   *
   * @param session - the session returned by `validateSession`
   * @returns the profile
   * @throws UnauthorizedException when the provider has no email for the user
   */
  getUserInfo(session: AuthSession): Promise<AuthUserInfo>
  /**
   * Builds the URL that ends the session at the identity provider (the counterpart of `login`).
   *
   * Only builds it: the browser has to navigate there, the provider calls nothing and keeps no state.
   *
   * @returns the end-session URL, or `null` when the provider has none
   */
  logout(): Promise<LogoutRequest>
}
