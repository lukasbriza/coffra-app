import type { ExecutionContext } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import type { ThrottlerModuleOptions } from '@nestjs/throttler'
import type { Redis } from 'ioredis'

import type { Env } from '../config'

import { STRICT_RATE_LIMIT } from './constants'
import { FailClosedThrottlerStorage } from './fail-closed-throttler-storage'
import { RedisThrottlerStorage } from './redis-throttler-storage'

const reflector = new Reflector()

/**
 * Tells whether the route being called is in the strict bucket (`@StrictRateLimit()` on the method or the class).
 *
 * @param context - the call being limited
 * @returns `true` for a strict route
 */
const isStrict = (context: ExecutionContext): boolean => {
  const strict = reflector.getAllAndOverride<boolean | undefined>(STRICT_RATE_LIMIT, [
    context.getHandler(),
    context.getClass(),
  ])

  return strict === true
}

/**
 * Builds the options of the rate limit from the configuration.
 *
 * - One throttler, so the answers carry the plain `Retry-After` and `X-RateLimit-*` headers (a named throttler would
 *   add its name to them).
 * - Two buckets per client address: `auth:<ip>` for the routes marked `@StrictRateLimit()` (the lower
 *   `RATE_LIMIT_AUTH_MAX`) and `global:<ip>` for the rest (`RATE_LIMIT_MAX`).
 * - The key is only the bucket and the client. The library's default key also holds the controller and the method,
 *   then every route would have its own counter and `login` and `refresh` would not add up.
 * - The counters are in Redis; when Redis does not answer, the request is refused with `503`
 *   (`FailClosedThrottlerStorage`).
 *
 * @param config - the validated environment
 * @param redis - the Redis client of the application (`RedisService`)
 * @returns the options for `ThrottlerModule`
 */
export const createRateLimitOptions = (config: ConfigService<Env, true>, redis: Redis): ThrottlerModuleOptions => {
  // The library counts in milliseconds, the environment in seconds.
  const ttl = config.get('RATE_LIMIT_TTL_SECONDS', { infer: true }) * 1000
  const max = config.get('RATE_LIMIT_MAX', { infer: true })
  const authMax = config.get('RATE_LIMIT_AUTH_MAX', { infer: true })

  return {
    throttlers: [{ ttl, limit: (context) => (isStrict(context) ? authMax : max) }],
    // `tracker` is the client address (`req.ip`).
    generateKey: (context, tracker) => `${isStrict(context) ? 'auth' : 'global'}:${tracker}`,
    storage: new FailClosedThrottlerStorage(new RedisThrottlerStorage(redis)),
  }
}
