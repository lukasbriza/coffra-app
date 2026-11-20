import 'reflect-metadata'

import { type INestApplication, Logger } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'
import { afterAll, afterEach, beforeAll, beforeEach, expect, type MockInstance, vi } from 'vitest'

import { configureApp } from '../../../src/app.setup'
import type { PrismaService } from '../../../src/modules/prisma'
import { CLIENT_ID, CLIENT_SECRET, FakeIdp, REDIRECT_URI } from '../../e2e/support/fake-idp'
import type { Browser } from '../../e2e/support/oidc-login'
import { withoutRateLimit } from '../../modules/rate-limit/rate-limit-overrides'
import { type Client, createClient } from '../support/client'
import { type Snapshot, takeSnapshot } from '../support/snapshot'
import { emptyTables, testDatabase } from '../support/test-database'

// The app of the main flow scenario: the real `AppModule` (config validation, every module, the global guard line of
// `main.ts`) with the real `PrismaService` on the test database, logged in to through the fake identity provider of
// the e2e specs. Unlike `useIntegrationApp`, nothing is seeded and no token is issued behind the app's back: the users
// come from the login, the data from the requests of the scenario.

/** Lifetime of an access token in the scenario: the moments the scenario moves the clock to are counted from it. */
export const ACCESS_TTL_SECONDS = 900

/** The variables the fake IdP needs on top of the environment of the suite; the issuer is added once it listens. */
const ENV: Record<string, string> = {
  OIDC_CLIENT_ID: CLIENT_ID,
  OIDC_CLIENT_SECRET: CLIENT_SECRET,
  OIDC_REDIRECT_URI: REDIRECT_URI,
  JWT_ACCESS_TTL_SECONDS: String(ACCESS_TTL_SECONDS),
}

/**
 * Everything from `src` that reaches `modules/config` is imported here, after the environment is set:
 * `ConfigModule.forRoot` validates the environment when that module is first imported, and the issuer is only known
 * once the fake IdP listens. That is why the scenario cannot use `useIntegrationApp`, which imports the app statically,
 * and why nothing in this folder may import such a module statically either.
 *
 * @returns the app module and the providers the bootstrap needs
 */
const loadApp = async () => {
  const { AppModule } = await import('../../../src/app.module.js')
  const { AuthTokensService, JwtAuthGuard } = await import('../../../src/modules/core/index.js')
  const { PrismaService: PrismaServiceClass } = await import('../../../src/modules/prisma/index.js')

  return { AppModule, AuthTokensService, JwtAuthGuard, PrismaServiceClass }
}

/**
 * Boots the app once for the spec file against the fake IdP and the test database, and empties the database before
 * and after every test. Call it inside the top `describe`: it registers the hooks of that block and returns the
 * helpers of the scenario.
 *
 * Every test also fails when anything was logged as an error (an unexpected `500`).
 *
 * @returns the helpers of the scenario
 */
export const useScenarioApp = () => {
  let idp: FakeIdp
  let app: INestApplication
  let prisma: PrismaService
  let error: MockInstance<Logger['error']>

  const server = (): App => app.getHttpServer() as App

  beforeAll(async () => {
    // Before the first TRUNCATE: nothing but a test database is ever emptied.
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    testDatabase(process.env.DATABASE_URL)

    idp = await FakeIdp.start()
    for (const [name, value] of Object.entries({ ...ENV, OIDC_ISSUER_URL: idp.issuer })) {
      vi.stubEnv(name, value)
    }
    const loaded = await loadApp()

    // Without the rate limit, as every bootstrap of the whole app: the limit has specs of its own, and its counters in
    // Redis would outlive the run (a second run within the window would meet the strict limit).
    const moduleRef = await withoutRateLimit(Test.createTestingModule({ imports: [loaded.AppModule] })).compile()

    app = moduleRef.createNestApplication({ logger: false })
    configureApp(app)
    // The line `main.ts` has (ADR 0011): without it the app has no authentication, and the expired token is let in.
    app.useGlobalGuards(new loaded.JwtAuthGuard(app.get(Reflector), app.get(loaded.AuthTokensService)))
    await app.init()

    prisma = app.get(loaded.PrismaServiceClass)
  })

  afterAll(async () => {
    await app.close()
    await idp.stop()
    vi.unstubAllEnvs()
  })

  beforeEach(async () => {
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {
      // collected and asserted in `afterEach`
    })
    idp.reset()
    await emptyTables(prisma)
  })

  afterEach(async () => {
    const logged = error.mock.calls

    vi.restoreAllMocks()
    vi.useRealTimers()
    // Nothing is left for the next spec file, whatever the scenario got to.
    await emptyTables(prisma)

    expect(logged, 'an error was logged: an unexpected 500?').toStrictEqual([])
  })

  return {
    /** The fake identity provider: `user` decides who the next login is. */
    idp: (): FakeIdp => idp,
    /** The client of the app, on the test database. */
    prisma: (): PrismaService => prisma,
    /** A new browser: its own cookie jar, like the one session of a real user. */
    browser: (): Browser => request.agent(server()),
    /** Requests with an access token. */
    as: (accessToken: string): Client => createClient(server, `Bearer ${accessToken}`),
    /** Requests without a token. */
    anonymous: (): Client => createClient(server),
    /** Every row of every table. */
    snapshot: (): Promise<Snapshot> => takeSnapshot(prisma),
  }
}
