import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // A freshly scaffolded app has no tests yet — don't fail the pipeline.
    passWithNoTests: true,
    // The HTTP and e2e specs boot a Nest app each and open many short-lived loopback connections. With the default
    // (one worker per core but one) connection setup on some Windows machines stalls in steps of 10 s and the specs
    // run into the 5 s test and 10 s hook timeouts; few workers keep the run stable.
    maxWorkers: 2,
    // Importing anything from `src/modules/config` validates the environment (`ConfigModule.forRoot`), so every spec
    // needs a complete one. Set here, the whole run is the same on every machine and in CI: `process.env` wins over a
    // developer's `.env`, which therefore changes nothing. Dummy values only, nothing is ever connected to. A spec
    // that needs other values stubs them itself (`vi.stubEnv`, see `test/e2e/auth/setup.ts`).
    env: {
      NODE_ENV: 'test',
      PORT: '3000',
      DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
      OIDC_ISSUER_URL: 'http://localhost:8080/realms/test',
      OIDC_CLIENT_ID: 'coffra-test',
      OIDC_CLIENT_SECRET: 'coffra-test-secret',
      OIDC_REDIRECT_URI: 'http://localhost:3000/api/auth/callback',
      JWT_ACCESS_SECRET: 'test-access-secret-with-at-least-32-chars',
      JWT_REFRESH_SECRET: 'test-refresh-secret-with-at-least-32-chars',
      AUTH_CHECKS_SECRET: 'test-checks-secret-with-at-least-32-chars',
      JWT_ACCESS_TTL_SECONDS: '900',
      JWT_REFRESH_TTL_SECONDS: '2592000',
    },
    // The e2e specs are the heaviest on the network (a whole login against the fake IdP per test), so they run as a
    // project of their own: after the rest (`groupOrder`), one file at a time. `pnpm test:unit` / `pnpm test:e2e`
    // runs one of them.
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['test/**/*.spec.ts'],
          exclude: [...configDefaults.exclude, 'test/e2e/**'],
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: 'e2e',
          include: ['test/e2e/**/*.spec.ts'],
          fileParallelism: false,
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
})
