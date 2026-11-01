import type { TestingModuleBuilder } from '@nestjs/testing'

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
