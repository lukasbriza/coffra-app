/** Metadata key that `@StrictRateLimit()` sets on a route or a controller. */
export const STRICT_RATE_LIMIT = 'rate-limit:strict'

/**
 * DI token of the rate limit guard. `APP_GUARD` points at it, so a test can switch the rate limit off by replacing this
 * one provider (`withoutRateLimit`).
 */
export const RATE_LIMIT_GUARD = Symbol('RATE_LIMIT_GUARD')

/** Prefix of every Redis key of the rate limit, so the keys do not clash with other data in the same Redis. */
export const REDIS_KEY_PREFIX = 'coffra:rate-limit:'

/** How long Redis is not asked after it failed, in milliseconds. Requests in that time get `503` at once. */
export const REDIS_PAUSE_MS = 1000
