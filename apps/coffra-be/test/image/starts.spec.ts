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
})
