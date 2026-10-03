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

/** A login the app has started: where to send the browser and the signed `checks` token for its cookie. */
export type StartedLogin = {
  authorizationUrl: string
  checksToken: string
}

/** The session the app issues after a login: its own access and refresh JWT (ADR 0006). */
export type TokenPair = {
  accessToken: string
  refreshToken: string
  /** Lifetime of the access token in seconds, the client plans its refresh by it. */
  expiresIn: number
}

/** A verified access token: who it was issued to. */
export type VerifiedAccessToken = {
  userId: string
}

/** A verified refresh token. `expiresAt` (JWT `exp`, seconds) is handed on to the next one, so the session has a fixed end. */
export type VerifiedRefreshToken = VerifiedAccessToken & {
  expiresAt: number
}

/** Where to send the browser to end the session at the IdP. */
export type LogoutRequest = {
  /** `null` when the IdP does not advertise an end-session endpoint (it is optional in OIDC discovery). */
  endSessionUrl: string | null
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
  /**
   * Builds the URL that ends the session at the identity provider (the counterpart of `login`). Only builds it:
   * the browser has to navigate there, the provider calls nothing and keeps no state.
   */
  logout(): Promise<LogoutRequest>
}
