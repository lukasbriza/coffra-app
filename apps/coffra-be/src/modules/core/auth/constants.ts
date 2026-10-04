/** DI token for the active `AuthProviderInterface`. Callers inject this, never a concrete provider class. */
export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER')

/** Scopes requested from the OIDC provider: `openid` for the ID token, the rest for the profile data we store. */
export const OIDC_SCOPE = 'openid email profile'

/** Cookie that carries the signed login checks (`state`, `nonce`, PKCE verifier) from `login` to the callback. */
export const AUTH_CHECKS_COOKIE = 'coffra_oidc_checks'

/** How long a login may take, from the redirect to the IdP until the callback. */
export const AUTH_CHECKS_TTL_SECONDS = 600

/** Metadata key set by `@Public()` and read by `JwtAuthGuard`. */
export const IS_PUBLIC_KEY = 'isPublic'
