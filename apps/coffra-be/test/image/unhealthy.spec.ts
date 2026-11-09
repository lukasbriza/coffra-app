import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { type App, startApp } from './support/container'
import { HOST_ALIAS, productionEnvironment } from './support/environment'

/**
 * The status code a route of the server answers with.
 *
 * @param app - the running container
 * @param path - the path, starting with `/`
 * @returns the status code
 */
const statusOf = async (app: App, path: string): Promise<number> => {
  const response = await app.get(path)

  return response.status
}

// The control of `starts.spec.ts`: a HEALTHCHECK that passes proves nothing unless it also fails when the app cannot
// reach its database.
describe('the server in the image without a database', () => {
  let app: App

  beforeAll(async () => {
    // Nothing listens on port 1 of the host
    app = await startApp(productionEnvironment(`postgresql://coffra:coffra@${HOST_ALIAS}:1/coffra`))
  })

  afterAll(async () => {
    await app.remove()
  })

  it('answers the health route with 503', async () => {
    await expect.poll(() => statusOf(app, '/api/health'), { timeout: 30_000 }).toBe(503)
  })

  it('turns unhealthy', async () => {
    await expect.poll(() => app.health(), { timeout: 45_000, interval: 1000 }).toBe('unhealthy')
  })
})
