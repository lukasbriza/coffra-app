import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerModule } from '@nestjs/throttler'

import { RedisService } from '../redis'

import { RATE_LIMIT_GUARD } from './constants'
import { RateLimitGuard } from './rate-limit.guard'
import { createRateLimitOptions } from './rate-limit.options'

/**
 * Rate limit of the whole API: how many requests one client address (`req.ip`) may send per window.
 *
 * How a request goes through it:
 * 1. `RateLimitGuard` (global) runs before `JwtAuthGuard`, so requests refused with `401` count too.
 * 2. `createRateLimitOptions` picks the bucket of the route: strict (`@StrictRateLimit()`, the login routes) or global.
 *    `@SkipRateLimit()` routes are not counted at all.
 * 3. `FailClosedThrottlerStorage` asks `RedisThrottlerStorage`, which counts in Redis, shared by every replica.
 * 4. Within the limit the request goes on; over it the answer is `429`; when Redis does not answer it is `503`.
 *
 * The guard is registered under `RATE_LIMIT_GUARD` and `APP_GUARD` points at it, so a test can replace it.
 * `TRUST_PROXY_HOPS` decides which address `req.ip` is.
 */
@Module({
  imports: [
    ThrottlerModule.forRootAsync({ inject: [ConfigService, RedisService], useFactory: createRateLimitOptions }),
  ],
  providers: [
    { provide: RATE_LIMIT_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useExisting: RATE_LIMIT_GUARD },
  ],
})
export class RateLimitModule {}
