import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { type App, startApp } from './support/container'
import { containerDatabaseUrl, imageDatabase, productionEnvironment } from './support/environment'

// The control of `redis.spec.ts`: Redis is a required service, like the database. A container whose Redis does not
// answer refuses the counted requests with 503 and is reported unhealthy, instead of letting requests through.

describe('the image when Redis does not answer', () => {
  let app: App

  beforeAll(async () => {
    // Nothing listens on port 1 inside the container.
    app = await startApp({
      ...productionEnvironment(containerDatabaseUrl(imageDatabase())),
      REDIS_URL: 'redis://127.0.0.1:1',
    })
  })

  afterAll(async () => {
    await app.remove()
  })

  it('answers the health route with 503 and names Redis', async () => {
    const status = async (): Promise<number> => {
      const probe = await app.get('/api/health')

      return probe.status
    }
    await expect.poll(status, { timeout: 30_000 }).toBe(503)

    const response = await app.get('/api/health')
    expect(await response.json()).toMatchObject({ error: { redis: { status: 'down' } } })
  })

  it('refuses a counted request with 503', async () => {
    const response = await app.get('/api/users/me')

    expect(response.status).toBe(503)
  })
})
