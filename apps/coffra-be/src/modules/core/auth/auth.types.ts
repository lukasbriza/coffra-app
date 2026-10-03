/**
 * Values the caller must keep between `login` and the callback. The provider is stateless:
 * where they are stored (e.g. a short-lived signed cookie) is the caller's decision.
 */
export type AuthChecks = {
  state: string
  nonce: string
  codeVerifier: string
}

export type LoginRequest = {
  /** Where to redirect the browser. */
  authorizationUrl: string
  checks: AuthChecks
}

export type AuthSession = {
  /** Stable user id at the identity provider (OIDC `sub`), maps to `User.externalSubject`. */
  subject: string
  /** Taken from the ID token when present. Use `getUserInfo` to obtain it otherwise. */
  email?: string | undefined
  /** Only for `getUserInfo`. The caller drops it afterwards, the app issues its own tokens. */
  accessToken: string
}

export type AuthUserInfo = {
  subject: string
  email: string
  emailVerified?: boolean | undefined
  name?: string | undefined
}

export type AuthProviderInterface = {
  /** Starts a login: builds the URL to send the browser to, plus the values to verify in the callback. */
  login(): Promise<LoginRequest>
  /**
   * Validates the identity provider's response to a login (for OIDC: exchanges the code and verifies the
   * ID token). Takes the callback query, not the request URL, so a reverse proxy cannot skew `redirect_uri`.
   * Throws `UnauthorizedException` when the response is not valid.
   */
  validateSession(callbackParams: URLSearchParams, checks: AuthChecks): Promise<AuthSession>
  /** Fetches the profile from the identity provider. Throws `UnauthorizedException` when it has no email. */
  getUserInfo(session: AuthSession): Promise<AuthUserInfo>
}
