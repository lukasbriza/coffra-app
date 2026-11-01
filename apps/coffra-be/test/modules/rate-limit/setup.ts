import 'reflect-metadata'

import { Controller, Get, type INestApplication, Post, Req } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import type { Request } from 'express'
import request from 'supertest'
import type { App } from 'supertest/types'
import { afterEach, beforeEach, vi } from 'vitest'

import { configureApp, GLOBAL_PREFIX } from '../../../src/app.setup'
import { RateLimitModule, SkipRateLimit, StrictRateLimit } from '../../../src/modules/rate-limit'

// Shared by the specs of the rate limit: the real `RateLimitModule` with the real guard in front of probe routes, one
// of each kind (plain, strict, skipped), over HTTP. The numbers come from the spec, not from the environment.

/** The start of every test; the window is counted from the clock, which only `travel` moves. */
export const START = new Date('2026-11-01T12:00:00.000Z')

/** Plain routes: the global bucket. */
@Controller('plain')
class PlainController {
  @Get()
  index(): { ok: true } {
    return { ok: true }
  }

  @Get('other')
  other(): { ok: true } {
    return { ok: true }
  }

  /** The address the limit counts for this request, as the application sees it. */
  @Get('who')
  who(@Req() req: Request): { ip: string | undefined } {
    return { ip: req.ip }
  }
}

/** Strict routes: the bucket of the login routes, two handlers to show that they share it. */
@Controller('strict')
@StrictRateLimit()
class StrictController {
  @Get('a')
  first(): { ok: true } {
    return { ok: true }
  }

  @Post('b')
  second(): { ok: true } {
    return { ok: true }
  }
}

/** A route outside the limit, like the health probe. */
@Controller('skipped')
@SkipRateLimit()
class SkippedController {
  @Get()
  index(): { ok: true } {
    return { ok: true }
  }
}

/** The numbers of the rate limit, as the environment would give them. */
export type Limits = { ttlSeconds: number; max: number; authMax: number }

/**
 * Moves the clock forward; only `Date` is faked, the sockets stay real.
 *
 * @param seconds - how far
 */
const travel = (seconds: number): void => {
  vi.setSystemTime(new Date(Date.now() + seconds * 1000))
}

/**
 * Boots the probe routes behind the real rate limit with `limits`. Call it inside a `describe`: it registers the
 * `beforeEach` and `afterEach` of that block (a fresh app, so fresh counters, and a stopped clock) and returns the
 * helpers of the specs.
 *
 * @param limits - the window and the two limits
 * @param trustProxyHops - how many proxies the app trusts for the client address
 */
export const useRateLimitApp = (limits: Limits, trustProxyHops = 0) => {
  let app: INestApplication

  // What `validateEnv` would return. The validated environment is what `ConfigService` reads first, so these numbers
  // win over the `process.env` of the test run.
  const values = {
    RATE_LIMIT_TTL_SECONDS: limits.ttlSeconds,
    RATE_LIMIT_MAX: limits.max,
    RATE_LIMIT_AUTH_MAX: limits.authMax,
  }

  const server = (): App => app.getHttpServer() as App

  /** `GET` `/api` + `path` with the given headers (`X-Forwarded-For`, ...). */
  const get = (path: string, headers: Record<string, string> = {}): request.Test =>
    request(server()).get(`/${GLOBAL_PREFIX}${path}`).set(headers)

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(START)

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, validate: () => values }), RateLimitModule],
      controllers: [PlainController, StrictController, SkippedController],
    }).compile()

    app = moduleRef.createNestApplication()
    configureApp(app, { trustProxyHops })
    await app.init()
  })

  afterEach(async () => {
    await app.close()
    vi.useRealTimers()
  })

  return { get, post: (path: string): request.Test => request(server()).post(`/${GLOBAL_PREFIX}${path}`), travel }
}
