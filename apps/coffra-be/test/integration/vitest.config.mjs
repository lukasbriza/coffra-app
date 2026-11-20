import { fileURLToPath } from 'node:url'

import { configDefaults, defineConfig } from 'vitest/config'

import { TEST_ENV } from '../../vitest.config.mjs'

import { databaseUrl } from './database-url.mjs'
import { redisUrl } from './redis-url.mjs'

// The integration suite (`pnpm test:integration`): the real app against a real Postgres. Not part of `pnpm test`,
// which needs no Docker. `pretest:integration` (`require-services.mjs`) first checks that Postgres and Redis listen.
// `globalSetup` recreates and migrates the database once per run and refuses any database whose name does not start
// with `coffra_test`: the specs truncate every table.
export default defineConfig({
  test: {
    name: 'integration',
    root: fileURLToPath(new URL('../..', import.meta.url)),
    include: ['test/integration/**/*.spec.ts'],
    exclude: configDefaults.exclude,
    globalSetup: ['test/integration/support/global-setup.ts'],
    // The whole-app specs replace the guard of the rate limit, so only the specs in `rate-limit/` count in Redis; they
    // read `TEST_REDIS_URL`. `REDIS_URL` points at the same one, should anything else ever count.
    env: { ...TEST_ENV, DATABASE_URL: databaseUrl(), REDIS_URL: redisUrl(), TEST_REDIS_URL: redisUrl() },
    // One database, emptied before every test: the files must not run at the same time. One worker also keeps the
    // loopback quiet (see the `maxWorkers` note in `vitest.config.mjs`).
    maxWorkers: 1,
    fileParallelism: false,
    hookTimeout: 30_000,
  },
})
