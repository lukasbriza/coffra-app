import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'

import { RATE_LIMIT_GUARD } from './constants'
import { createRateLimitOptions } from './rate-limit.options'

/**
 * Rate limit of the whole API, per client address (`req.ip`, so `TRUST_PROXY_HOPS` decides which address that is).
 *
 * The guard is global and registered here, as a provider under `RATE_LIMIT_GUARD`, so it runs before the
 * `JwtAuthGuard` that `main.ts` adds (the requests turned away with `401` are counted too). The counters are kept in
 * the memory of the process: one replica, and a restart starts from zero.
 */
@Module({
  imports: [ThrottlerModule.forRootAsync({ inject: [ConfigService], useFactory: createRateLimitOptions })],
  providers: [
    { provide: RATE_LIMIT_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: RATE_LIMIT_GUARD },
  ],
})
export class RateLimitModule {}
