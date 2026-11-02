import { fileURLToPath } from 'node:url'

import { configDefaults, defineConfig } from 'vitest/config'

import { redisUrl } from '../integration/redis-url.mjs'

import { imageDatabaseUrl } from './database-url.mjs'

// The image suite (`pnpm test:image`): the production image of the app, run with Docker against a real Postgres. Not
// part of `pnpm test` (no Docker there) and not part of the integration suite (that one runs the app from source).
// Build the image first (`pnpm image:build`); `IMAGE` names another one. The global setup recreates and migrates the
// database `coffra_test_image` once per run, through the image itself, and removes every container of the suite.
export default defineConfig({
  test: {
    name: 'image',
    root: fileURLToPath(new URL('../..', import.meta.url)),
    include: ['test/image/**/*.spec.ts'],
    exclude: configDefaults.exclude,
    globalSetup: ['test/image/support/global-setup.ts'],
    // `TEST_REDIS_URL` is for the one spec that runs the image with `REDIS_URL` (`redis.spec.ts`).
    env: { DATABASE_URL: imageDatabaseUrl(), TEST_REDIS_URL: redisUrl() },
    // One database and a handful of containers: the files run one after another. One worker also keeps the loopback
    // quiet (see the `maxWorkers` note in `vitest.config.mjs`).
    maxWorkers: 1,
    fileParallelism: false,
    // A container takes seconds to start, and a stop waits for the process to exit.
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
})
