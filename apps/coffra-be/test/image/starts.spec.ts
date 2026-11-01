import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { type App, startApp } from './support/container'
import { containerDatabaseUrl, imageDatabase, productionEnvironment } from './support/environment'

describe('the server in the image', () => {
  let app: App

  beforeAll(async () => {
    app = await startApp(productionEnvironment(containerDatabaseUrl(imageDatabase())))
    await app.waitHealthy()
  })

  afterAll(async () => {
    await app.remove()
  })

  it('passes the HEALTHCHECK of the image', async () => {
    expect(await app.health()).toBe('healthy')
  })

  it('answers the health route with the database up', async () => {
    const response = await app.get('/api/health')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: 'ok', info: { database: { status: 'up' } } })
  })

  it('keeps every other route behind the guard', async () => {
    const response = await app.get('/api/users/me')

    expect(response.status).toBe(401)
  })

  // `helmet` and `@nestjs/throttler` are production dependencies: they have to be in the tree `pnpm deploy --prod`
  // builds and load from the compiled CommonJS output, or the container would not start at all.
  it('sends the security headers and no X-Powered-By', async () => {
    const response = await app.get('/api/health')

    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('content-security-policy')).toContain("default-src 'none'")
    expect(response.headers.get('x-powered-by')).toBeNull()
  })

  it('limits the requests with the default of 120 per window, and leaves the health probe out', async () => {
    const limited = await app.get('/api/users/me')
    const probe = await app.get('/api/health')

    expect(limited.headers.get('x-ratelimit-limit')).toBe('120')
    expect(probe.headers.get('x-ratelimit-limit')).toBeNull()
  })
})
