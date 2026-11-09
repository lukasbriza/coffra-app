import type { Redis } from 'ioredis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { REDIS_KEY_PREFIX } from '../../src/modules/rate-limit/constants'
import { clearRateLimitKeys, openRedis } from '../integration/support/redis'

import { type App, startApp } from './support/container'
import {
  containerDatabaseUrl,
  containerRedisUrl,
  imageDatabase,
  productionEnvironment,
  SECRETS,
} from './support/environment'

// `ioredis` is a production dependency: it has to be in the tree `pnpm deploy --prod` builds and load from the
// compiled CommonJS output, or the container would not count a single request. Here it counts in the Redis of the
// suite, which the container reaches through the host (`REDIS_URL` is part of `productionEnvironment`).

describe('the rate limit in the image', () => {
  let app: App
  let redis: Redis

  beforeAll(async () => {
    redis = openRedis()
    await clearRateLimitKeys(redis)

    app = await startApp(productionEnvironment(containerDatabaseUrl(imageDatabase())))
    await app.waitHealthy()
  })

  afterAll(async () => {
    await app.remove()
    await clearRateLimitKeys(redis)
    await redis.quit()
  })

  it('counts the requests in Redis, not in its own memory', async () => {
    const response = await app.get('/api/users/me')

    expect(response.status).toBe(401)
    expect(response.headers.get('x-ratelimit-limit')).toBe('120')
    const keys = await redis.keys(`${REDIS_KEY_PREFIX}*`)
    expect(keys.length).toBeGreaterThan(0)
  })

  it('reports Redis in the health probe', async () => {
    const response = await app.get('/api/health')

    expect(await response.json()).toMatchObject({ status: 'ok', info: { redis: { status: 'up' } } })
  })

  it('does not report that Redis failed', async () => {
    const logs = await app.logs()

    expect(logs).not.toContain('Redis failed')
  })

  it('leaves the address of Redis out of the log', async () => {
    const logs = await app.logs()

    expect(logs).not.toContain(containerRedisUrl())
    for (const secret of Object.values(SECRETS)) {
      expect(logs).not.toContain(secret)
    }
  })
})
