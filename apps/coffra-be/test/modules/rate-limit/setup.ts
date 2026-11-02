import { afterEach, beforeEach, vi } from 'vitest'

import { type ProbeApp, startProbeApp } from './probe-app'

// Shared by the unit specs of the rate limit: a fresh probe app for every test (so fresh counters), counting in
// memory, with a stopped clock that only `travel` moves. The limits come from the spec, not from the environment.

/** The start of every test. */
export const START = new Date('2026-11-01T12:00:00.000Z')

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
 * Starts the probe app with `limits` before every test of the `describe` it is called in, and stops it after.
 *
 * @param limits - the window and the two limits
 * @param options - `trustProxyHops`: how many proxies the app trusts for the client address; `0` when left out
 * @returns `get` and `post` to the probe routes, and `travel` to move the clock
 */
export const useRateLimitApp = (limits: Limits, { trustProxyHops = 0 }: { trustProxyHops?: number } = {}) => {
  let app: ProbeApp

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(START)

    app = await startProbeApp({
      environment: {
        RATE_LIMIT_TTL_SECONDS: limits.ttlSeconds,
        RATE_LIMIT_MAX: limits.max,
        RATE_LIMIT_AUTH_MAX: limits.authMax,
        // Never connected to: the counters are in memory here.
        REDIS_URL: 'redis://127.0.0.1:6389',
      },
      trustProxyHops,
      countInMemory: true,
    })
  })

  afterEach(async () => {
    await app.close()
    vi.useRealTimers()
  })

  return {
    get: (path: string, headers?: Record<string, string>) => app.get(path, headers),
    post: (path: string) => app.post(path),
    travel,
  }
}
