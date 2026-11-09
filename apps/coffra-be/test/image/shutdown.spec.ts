import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { connect } from '../integration/support/test-database'

import { type App, startApp } from './support/container'
import { containerDatabaseUrl, imageDatabase, productionEnvironment } from './support/environment'

/**
 * How many connections other than this one the database of the suite has.
 *
 * @returns the number of connections
 */
const connections = async (): Promise<number> => {
  const database = imageDatabase()
  const client = connect(database.url)

  try {
    const rows = await client.$queryRaw<{ count: number }[]>`
      SELECT count(*)::int AS count FROM pg_stat_activity
       WHERE datname = ${database.name} AND pid <> pg_backend_pid()`

    return rows[0]?.count ?? 0
  } finally {
    await client.$disconnect()
  }
}

describe('stopping the server in the image', () => {
  let app: App

  beforeAll(async () => {
    app = await startApp(productionEnvironment(containerDatabaseUrl(imageDatabase())))
    await app.waitHealthy()
  })

  afterAll(async () => {
    await app.remove()
  })

  it('ends on SIGTERM by itself and closes its connections to the database', async () => {
    // The control: while it runs, the server holds a connection (the health check uses it)
    expect(await connections()).toBeGreaterThan(0)

    const code = await app.stop()

    // 0 when it ends by itself, 143 when it re-raises the signal; 137 would be the kill after the grace period
    expect([0, 143]).toContain(code)
    await expect.poll(connections, { timeout: 5000 }).toBe(0)
  })
})
