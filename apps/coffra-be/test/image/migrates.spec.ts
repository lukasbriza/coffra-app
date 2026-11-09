import { readdirSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { connect } from '../integration/support/test-database'

import { MIGRATE_COMMAND, runOnce } from './support/container'
import { containerDatabaseUrl, imageDatabase } from './support/environment'

// The global setup has already run `migrate deploy` in the image on an empty database.
describe('migrate deploy in the image', () => {
  it('has applied every migration of the app', async () => {
    const folders = readdirSync(path.join(__dirname, '..', '..', 'prisma', 'migrations'), { withFileTypes: true })
    const expected = folders.filter((entry) => entry.isDirectory()).length
    const client = connect(imageDatabase().url)

    try {
      const rows = await client.$queryRaw<{ count: number }[]>`
        SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL`

      expect(expected).toBeGreaterThan(0)
      expect(rows[0]?.count).toBe(expected)
    } finally {
      await client.$disconnect()
    }
  })

  it('has nothing left to do the second time', async () => {
    const result = await runOnce({
      environment: { DATABASE_URL: containerDatabaseUrl(imageDatabase()) },
      command: MIGRATE_COMMAND,
    })

    expect(result.code).toBe(0)
    expect(result.output).toContain('No pending migrations to apply')
  })
})
