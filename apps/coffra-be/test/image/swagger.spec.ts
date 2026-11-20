import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { type App, startApp } from './support/container'
import { containerDatabaseUrl, imageDatabase, productionEnvironment } from './support/environment'

// The control of the Swagger case in `starts.spec.ts`: production serves no Swagger by default, and `SWAGGER_ENABLED`
// turns it on there. Without this one, a Swagger that is never served would pass that spec too.

describe('the image with SWAGGER_ENABLED=true', () => {
  let app: App

  beforeAll(async () => {
    app = await startApp({ ...productionEnvironment(containerDatabaseUrl(imageDatabase())), SWAGGER_ENABLED: 'true' })
    await app.waitHealthy()
  })

  afterAll(async () => {
    await app.remove()
  })

  it('serves the Swagger UI and the OpenAPI document', async () => {
    const page = await app.get('/api/swagger')
    const document = await app.get('/api/swagger-json')

    expect(page.status).toBe(200)
    expect(document.status).toBe(200)
  })
})
