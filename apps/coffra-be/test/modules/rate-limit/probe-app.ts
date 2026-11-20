import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'

import { configureApp, GLOBAL_PREFIX } from '../../../src/app.setup'
import { RateLimitModule } from '../../../src/modules/rate-limit'
import { RedisModule } from '../../../src/modules/redis'
import { ConfigStubModule } from '../config/config-stub'

import { PROBE_CONTROLLERS } from './probe-controllers'
import { withMemoryRateLimit } from './rate-limit-overrides'

// A small app for the specs of the rate limit: the real `RateLimitModule` (guard, options, storage) in front of the
// probe routes, and nothing else of the application. The unit specs (`setup.ts`) start one per test and count in
// memory; the integration specs start several against one Redis, as replicas.

/** The configuration the rate limit reads, as `validateEnv` would return it. */
export type RateLimitEnvironment = {
  RATE_LIMIT_TTL_SECONDS: number
  RATE_LIMIT_MAX: number
  RATE_LIMIT_AUTH_MAX: number
  REDIS_URL: string
}

/**
 * How to start the probe app.
 *
 * @property environment - the configuration; apps with the same `REDIS_URL` share the counters
 * @property trustProxyHops - how many proxies the app trusts for the client address; `0` when left out
 * @property countInMemory - count in the memory of the process instead of Redis (`withMemoryRateLimit`), for the specs
 * that move `Date`; Redis is never connected to then. `false` when left out
 */
export type ProbeAppOptions = {
  environment: RateLimitEnvironment
  trustProxyHops?: number
  countInMemory?: boolean
}

/** A running probe app. */
export type ProbeApp = {
  /** `GET /api` + `path` with the given headers (`X-Forwarded-For`, ...). */
  get: (path: string, headers?: Record<string, string>) => request.Test
  /** `POST /api` + `path`. */
  post: (path: string) => request.Test
  /** Stops the app like a restart of the container does (shutdown hooks included). */
  close: () => Promise<void>
}

/**
 * Starts the probe app.
 *
 * @param options - the configuration, the proxies and where to count
 * @returns the running app
 */
export const startProbeApp = async ({
  environment,
  trustProxyHops = 0,
  countInMemory = false,
}: ProbeAppOptions): Promise<ProbeApp> => {
  const builder = Test.createTestingModule({
    imports: [ConfigStubModule.with(environment), RedisModule, RateLimitModule],
    controllers: PROBE_CONTROLLERS,
  })
  const moduleRef = await (countInMemory ? withMemoryRateLimit(builder) : builder).compile()

  const app = moduleRef.createNestApplication()
  configureApp(app, { trustProxyHops })
  await app.init()

  const server = (): App => app.getHttpServer() as App

  return {
    get: (path, headers = {}) => request(server()).get(`/${GLOBAL_PREFIX}${path}`).set(headers),
    post: (path) => request(server()).post(`/${GLOBAL_PREFIX}${path}`),
    close: () => app.close(),
  }
}
