import { Logger } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { REDIS_KEY_PREFIX } from '../../../src/modules/rate-limit/constants'
import { type ProbeApp, startProbeApp } from '../../modules/rate-limit/probe-app'
import { clearRateLimitKeys, openRedis, testRedisUrl } from '../support/redis'

// The point of the Redis storage: several replicas of the application, one limit. Each test starts its own replicas
// (the probe app of the unit specs, counting in Redis) against the Redis of the suite, with a limit of 3 and, for the
// strict routes, 2. Real time, but the window is a minute: nothing here waits for it.

const LIMITS = { RATE_LIMIT_TTL_SECONDS: 60, RATE_LIMIT_MAX: 3, RATE_LIMIT_AUTH_MAX: 2 }

/** Sends `GET /plain` until the limit of 3 is used up. */
const useUpLimit = async (replica: ProbeApp): Promise<void> => {
  for (let call = 0; call < LIMITS.RATE_LIMIT_MAX; call += 1) {
    await replica.get('/plain').expect(200)
  }
}

describe('the rate limit of more than one replica', () => {
  let redis: Redis
  let replicas: ProbeApp[]

  /**
   * Starts a replica; the hooks stop it after the test.
   *
   * @param options - `redisUrl`: the Redis of the suite when left out; `trustProxyHops`: `0` when left out
   */
  const start = async ({
    redisUrl = testRedisUrl(),
    trustProxyHops = 0,
  }: { redisUrl?: string; trustProxyHops?: number } = {}): Promise<ProbeApp> => {
    const replica = await startProbeApp({ environment: { ...LIMITS, REDIS_URL: redisUrl }, trustProxyHops })
    replicas.push(replica)

    return replica
  }

  // The hits of a client below the limit, and the block of a client over it, are different keys.
  const expectEveryKeyToExpire = async (expected: number): Promise<void> => {
    const keys = await redis.keys(`${REDIS_KEY_PREFIX}*`)
    const lifetimes = await Promise.all(keys.map((key) => redis.pttl(key)))

    expect(keys).toHaveLength(expected)
    for (const lifetime of lifetimes) {
      expect(lifetime).toBeGreaterThan(0)
      expect(lifetime).toBeLessThanOrEqual(60_000)
    }
  }

  /** How many connections the Redis of the suite has open, this spec's own included. */
  const connections = async (): Promise<number> => {
    const info = await redis.info('clients')

    return Number(/connected_clients:(\d+)/u.exec(info)?.[1])
  }

  beforeAll(() => {
    redis = openRedis()
  })

  afterAll(async () => {
    await redis.quit()
  })

  beforeEach(async () => {
    replicas = []
    await clearRateLimitKeys(redis)
  })

  afterEach(async () => {
    await Promise.all(replicas.map((replica) => replica.close()))
    vi.restoreAllMocks()
    await clearRateLimitKeys(redis)
  })

  describe('with Redis', () => {
    it('counts the requests of all replicas against one limit', async () => {
      const first = await start()
      const second = await start()

      await first.get('/plain').expect(200)
      await second.get('/plain').expect(200)
      await first.get('/plain').expect(200)

      await second.get('/plain').expect(429)
      await first.get('/plain').expect(429)
    })

    it('tells every replica how much of the limit is left, whoever used it', async () => {
      const first = await start()
      const second = await start()

      await first.get('/plain').expect(200)
      const response = await second.get('/plain').expect(200)

      expect(response.headers['x-ratelimit-limit']).toBe('3')
      expect(response.headers['x-ratelimit-remaining']).toBe('1')
    })

    it('answers a request over the limit with 429 and how long to wait, on whichever replica it arrives', async () => {
      const first = await start()
      const second = await start()

      await useUpLimit(first)
      const response = await second.get('/plain').expect(429)

      expect(response.body).toStrictEqual({ statusCode: 429, message: 'ThrottlerException: Too Many Requests' })
      expect(Number(response.headers['retry-after'])).toBeGreaterThan(0)
      expect(Number(response.headers['retry-after'])).toBeLessThanOrEqual(60)
    })

    it('keeps the strict routes in a bucket of their own, shared by the replicas too', async () => {
      const first = await start()
      const second = await start()

      await first.get('/strict/a').expect(200)
      await second.post('/strict/b').expect(201)
      await first.get('/strict/a').expect(429)

      const plain = await second.get('/plain').expect(200)
      expect(plain.headers['x-ratelimit-remaining']).toBe('2')
    })

    it('tells clients apart across replicas by the address behind the proxy', async () => {
      const first = await start({ trustProxyHops: 1 })
      const second = await start({ trustProxyHops: 1 })

      await first.get('/plain', { 'X-Forwarded-For': '203.0.113.1' }).expect(200)
      await second.get('/plain', { 'X-Forwarded-For': '203.0.113.1' }).expect(200)
      await first.get('/plain', { 'X-Forwarded-For': '203.0.113.1' }).expect(200)
      await second.get('/plain', { 'X-Forwarded-For': '203.0.113.1' }).expect(429)

      await second.get('/plain', { 'X-Forwarded-For': '203.0.113.2' }).expect(200)
    })

    it('does not start from zero when a replica restarts', async () => {
      const before = await start()
      await useUpLimit(before)
      await before.close()

      const after = await start()

      await after.get('/plain').expect(429)
    })

    it('closes its connection to Redis when the replica shuts down', async () => {
      const before = await connections()
      const replica = await start()
      await replica.get('/plain').expect(200)

      // The control: while the replica runs, it holds a connection of its own.
      expect(await connections()).toBeGreaterThan(before)

      await replica.close()

      await expect.poll(connections, { timeout: 5000 }).toBe(before)
    })

    it('does not count a route that is outside the limit', async () => {
      const replica = await start()

      await replica.get('/skipped').expect(200)

      expect(await redis.keys(`${REDIS_KEY_PREFIX}*`)).toStrictEqual([])
    })

    describe('leaves no key that lives forever', () => {
      it('below the limit: the hits expire within the window', async () => {
        const replica = await start()

        await replica.get('/plain').expect(200)
        await replica.get('/plain').expect(200)

        await expectEveryKeyToExpire(1)
      })

      it('over the limit: the block expires within the window', async () => {
        const replica = await start()

        await useUpLimit(replica)
        await replica.get('/plain').expect(429)

        await expectEveryKeyToExpire(1)
      })
    })
  })

  describe('when Redis cannot be reached', () => {
    // Nothing listens on port 1. The URL carries a password and a host to prove that the log does not.
    const UNREACHABLE = 'redis://:hunter2@127.0.0.1:1'

    beforeEach(() => {
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {
        // expected here: Redis is away on purpose; the last test reads what was logged
      })
    })

    it('refuses every request with 503, never lets one through uncounted', async () => {
      const first = await start({ redisUrl: UNREACHABLE })
      const second = await start({ redisUrl: UNREACHABLE })

      for (let call = 0; call < 3; call += 1) {
        const response = await first.get('/plain').expect(503)
        expect(response.body).toStrictEqual({ statusCode: 503, message: 'Service Unavailable' })
        // The pause after a failure of Redis: the client knows when to try again, as after a 429.
        expect(response.headers['retry-after']).toBe('1')
      }
      await second.get('/strict/a').expect(503)
    })

    it('still answers a route outside the limit (the health probe reports Redis itself)', async () => {
      const replica = await start({ redisUrl: UNREACHABLE })

      await replica.get('/skipped').expect(200)
    })

    it('says so once, and leaves the address and the password of Redis out of the log', async () => {
      const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {
        // collected below
      })
      const replica = await start({ redisUrl: UNREACHABLE })

      for (let call = 0; call < 3; call += 1) {
        await replica.get('/plain').expect(503)
      }

      const messages = error.mock.calls.map(([message]) => String(message))
      expect(messages.filter((message) => message.includes('Redis failed'))).toHaveLength(1)
      for (const message of messages) {
        expect(message).not.toContain('hunter2')
        expect(message).not.toContain('127.0.0.1')
      }
    })
  })
})
