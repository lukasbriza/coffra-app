import type { TestingModuleBuilder } from '@nestjs/testing'
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler'

import { RATE_LIMIT_GUARD } from '../../../src/modules/rate-limit'

/**
 * Takes the rate limit out of a testing module: the guard that counts the requests is replaced by one that lets every
 * request through, and everything else of the application stays as it is. Every bootstrap of the whole `AppModule`
 * (the e2e specs, the integration suite) applies it, so a suite that sends hundreds of requests from one address never
 * meets a `429`; the specs that prove the limit opt out of it.
 *
 * @param builder - the testing module before `compile()`
 * @returns the same builder
 */
export const withoutRateLimit = (builder: TestingModuleBuilder): TestingModuleBuilder =>
  builder.overrideProvider(RATE_LIMIT_GUARD).useValue({ canActivate: () => true })

/**
 * Keeps the real rate limit of a testing module but counts in the memory of the process, not in Redis. For the specs of
 * the limit that move the clock (`vi.useFakeTimers({ toFake: ['Date'] })`): Redis has a clock of its own, so a stopped
 * `Date` would say nothing about it. What Redis does is proven against a real one in `test/integration/rate-limit/`;
 * the application never connects to it here (the connection is opened by the first counted request).
 *
 * @param builder - the testing module before `compile()`
 * @returns the same builder
 */
export const withMemoryRateLimit = (builder: TestingModuleBuilder): TestingModuleBuilder =>
  builder.overrideProvider(ThrottlerStorage).useValue(new ThrottlerStorageService())
