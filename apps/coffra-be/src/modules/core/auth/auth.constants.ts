/** DI token for the active `AuthProviderInterface`. Callers inject this, never a concrete provider class. */
export const AUTH_PROVIDER = Symbol('AUTH_PROVIDER')

/** Scopes requested from the OIDC provider: `openid` for the ID token, the rest for the profile data we store. */
export const OIDC_SCOPE = 'openid email profile'
