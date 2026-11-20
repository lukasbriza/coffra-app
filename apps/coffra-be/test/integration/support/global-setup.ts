import { execFileSync } from 'node:child_process'
import path from 'node:path'

import type { TestProject } from 'vitest/node'

import { maintain, type TestDatabase, testDatabase } from './test-database'

// Runs once per `pnpm test:integration`, before any spec file: a fresh test database with every migration applied,
// dropped again at the end. A run that crashed leaves its database behind; the next one starts by dropping it.

/**
 * Applies the migrations of the app to the test database, as a deploy does.
 *
 * @param database - the test database
 * @param root - the folder of the app (`prisma.config.ts`, `node_modules`)
 * @throws Error with the output of Prisma when a migration fails
 */
const migrate = (database: TestDatabase, root: string): void => {
  // The Prisma CLI through Node, not `pnpm exec`: no shell and no `.cmd` shim on Windows. `prisma.config.ts` loads
  // `.env`, but a variable that is already set wins, so the migration goes to the test database.
  const cli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js')

  try {
    execFileSync(process.execPath, [cli, 'migrate', 'deploy'], {
      cwd: root,
      env: { ...process.env, DATABASE_URL: database.url },
      stdio: 'pipe',
    })
  } catch (error) {
    const output = error as { stdout?: Buffer; stderr?: Buffer }
    throw new Error(
      `prisma migrate deploy failed on ${database.name}:\n${output.stdout?.toString() ?? ''}${output.stderr?.toString() ?? ''}`,
    )
  }
}

/**
 * Creates and migrates the test database, and returns the teardown that drops it.
 *
 * @param project - the vitest project; its `env` holds the `DATABASE_URL` of the suite
 * @returns the teardown
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const database = testDatabase(project.config.env.DATABASE_URL)

  await maintain(database, `DROP DATABASE IF EXISTS "${database.name}" WITH (FORCE)`)
  await maintain(database, `CREATE DATABASE "${database.name}"`)
  migrate(database, project.config.root)

  return async () => {
    await maintain(database, `DROP DATABASE IF EXISTS "${database.name}" WITH (FORCE)`)
  }
}
