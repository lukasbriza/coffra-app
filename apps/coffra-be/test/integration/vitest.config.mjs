import { fileURLToPath } from 'node:url'

import { configDefaults, defineConfig } from 'vitest/config'

import { TEST_ENV } from '../../vitest.config.mjs'

import { databaseUrl } from './database-url.mjs'

// The integration suite (`pnpm test:integration`): the real app against a real Postgres. Not part of `pnpm test`,
// which needs no Docker. `pretest:integration` (`require-postgres.mjs`) first checks that the Postgres listens.
// `globalSetup` recreates and migrates the database once per run and refuses any database whose name does not start
// with `coffra_test`: the specs truncate every table.
export default defineConfig({
  test: {
    name: 'integration',
    root: fileURLToPath(new URL('../..', import.meta.url)),
    include: ['test/integration/**/*.spec.ts'],
    exclude: configDefaults.exclude,
    globalSetup: ['test/integration/support/global-setup.ts'],
    env: { ...TEST_ENV, DATABASE_URL: databaseUrl() },
    // One database, emptied before every test: the files must not run at the same time. One worker also keeps the
    // loopback quiet (see the `maxWorkers` note in `vitest.config.mjs`).
    maxWorkers: 1,
    fileParallelism: false,
    hookTimeout: 30_000,
  },
})
