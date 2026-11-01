/** Metadata key `@StrictRateLimit()` sets on a route or a whole controller. */
export const STRICT_RATE_LIMIT = 'rate-limit:strict'

/**
 * Token of the guard that counts the requests. `APP_GUARD` points at it, so a test that must not be limited replaces
 * this one provider and leaves everything else of the application as it is.
 */
export const RATE_LIMIT_GUARD = Symbol('RATE_LIMIT_GUARD')
