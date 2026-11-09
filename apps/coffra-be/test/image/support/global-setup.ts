import type { TestProject } from 'vitest/node'

import { maintain, testDatabase } from '../../integration/support/test-database'

import { docker, MIGRATE_COMMAND, removeLeftovers, runOnce } from './container'
import { containerDatabaseUrl, IMAGE } from './environment'

// Runs once per `pnpm test:image`, before any spec file: a fresh database with every migration applied by the image
// itself, as a deploy does, and no container of an earlier run left behind. Dropped and removed again at the end.

/**
 * Checks that the image under test exists.
 *
 * @throws Error telling how to build it when it does not
 */
const requireImage = async (): Promise<void> => {
  const found = await docker(['image', 'inspect', IMAGE, '--format', '{{.Id}}'])

  if (found.code !== 0) {
    throw new Error(`The image "${IMAGE}" does not exist. Build it first with \`pnpm image:build\`.`)
  }
}

/**
 * Creates and migrates the database of the suite, and returns the teardown that removes it with the containers.
 *
 * @param project - the vitest project; its `env` holds the `DATABASE_URL` of the suite
 * @returns the teardown
 * @throws Error when the image is missing or a migration fails
 */
export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  const database = testDatabase(project.config.env.DATABASE_URL)

  await requireImage()
  await removeLeftovers()
  await maintain(database, `DROP DATABASE IF EXISTS "${database.name}" WITH (FORCE)`)
  await maintain(database, `CREATE DATABASE "${database.name}"`)

  const migration = await runOnce({
    environment: { DATABASE_URL: containerDatabaseUrl(database) },
    command: MIGRATE_COMMAND,
  })

  if (migration.code !== 0) {
    throw new Error(`prisma migrate deploy failed in the image on ${database.name}:\n${migration.output}`)
  }

  return async () => {
    await removeLeftovers()
    await maintain(database, `DROP DATABASE IF EXISTS "${database.name}" WITH (FORCE)`)
  }
}
