import type { ExecutionContext } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import type { ThrottlerModuleOptions } from '@nestjs/throttler'

import type { Env } from '../config'

import { STRICT_RATE_LIMIT } from './constants'

const reflector = new Reflector()

/**
 * Tells whether the route being called is in the strict bucket (`@StrictRateLimit()` on the method or the class).
 *
 * @param context - the call being limited
 * @returns `true` for a strict route
 */
const isStrict = (context: ExecutionContext): boolean =>
  reflector.getAllAndOverride<boolean | undefined>(STRICT_RATE_LIMIT, [context.getHandler(), context.getClass()]) ===
  true

/**
 * Builds the options of the rate limit from the configuration.
 *
 * There is one throttler (so the answers carry the plain `Retry-After` and `X-RateLimit-*` headers) and two buckets
 * per client address: the strict one for the routes marked `@StrictRateLimit()` and the global one for the rest. The
 * bucket is told apart by the key, which holds the bucket and the client but, unlike the default of the library, **not
 * the controller and the method**: otherwise every route would have a counter of its own and `login` and `refresh`
 * would not add up.
 *
 * @param config - the validated environment
 * @returns the options for `ThrottlerModule`; the window is in milliseconds, as the library wants it
 */
export function createRateLimitOptions(config: ConfigService<Env, true>): ThrottlerModuleOptions {
  const ttl = config.get('RATE_LIMIT_TTL_SECONDS', { infer: true }) * 1000
  const max = config.get('RATE_LIMIT_MAX', { infer: true })
  const authMax = config.get('RATE_LIMIT_AUTH_MAX', { infer: true })

  return {
    throttlers: [{ ttl, limit: (context) => (isStrict(context) ? authMax : max) }],
    generateKey: (context, tracker) => `${isStrict(context) ? 'auth' : 'global'}:${tracker}`,
  }
}
