import 'reflect-metadata'

import { randomUUID } from 'node:crypto'

import { type INestApplication, Logger, type ModuleMetadata } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'
import { afterAll, afterEach, beforeAll, beforeEach, expect, type MockInstance, vi } from 'vitest'

import { AppModule } from '../../../src/app.module'
import { configureApp } from '../../../src/app.setup'
import { AuthTokensService, JwtAuthGuard } from '../../../src/modules/core'
import { PrismaService } from '../../../src/modules/prisma'

import { type Snapshot, takeSnapshot } from './snapshot'
import { testDatabase } from './test-database'
import { type Persona, seedWorld, type World } from './world'

// Shared by every integration spec: the real `AppModule` (config validation, every module, the global guard line of
// `main.ts`) with the real `PrismaService` on the test database. Nothing in the chain that decides whose rows a
// request sees is replaced. Only the login is skipped: the access tokens come from the real `AuthTokensService`.

/** Requests to the app under test, with or without a token. */
export type Client = {
  get: (path: string) => request.Test
  post: (path: string, body?: object) => request.Test
  patch: (path: string, body: object) => request.Test
  delete: (path: string) => request.Test
}

/** Extra modules for the testing module (e.g. `DiscoveryModule` to list the routes). */
type Options = { imports?: ModuleMetadata['imports'] }

/**
 * Boots the app once for the spec file and gives every test a database with the two users of `seedWorld`. Call it
 * inside the top `describe`: it registers the hooks of that block and returns the helpers of the specs.
 *
 * Every test also fails when anything was logged as an error (an unexpected `500`), unless it calls `expectErrors()`.
 *
 * @param options - extra imports for the testing module
 * @returns the helpers of the specs
 */
export const useIntegrationApp = ({ imports = [] }: Options = {}) => {
  let app: INestApplication
  let prisma: PrismaService
  let tokens: AuthTokensService
  let world: World
  let error: MockInstance<Logger['error']>
  let errorsExpected = false

  const server = (): App => app.getHttpServer() as App

  const client = (authorization?: string): Client => {
    const authorize = (test: request.Test): request.Test =>
      authorization === undefined ? test : test.set('Authorization', authorization)

    return {
      get: (path) => authorize(request(server()).get(path)),
      post: (path, body = {}) => authorize(request(server()).post(path)).send(body),
      patch: (path, body) => authorize(request(server()).patch(path)).send(body),
      delete: (path) => authorize(request(server()).delete(path)),
    }
  }

  const issueToken = async (userId: string): Promise<string> => {
    const { accessToken } = await tokens.issue(userId)

    return accessToken
  }

  const snapshot = (): Promise<Snapshot> => takeSnapshot(prisma)

  /**
   * Runs `action` and asserts that the database is exactly as before.
   *
   * @param action - what must not write anything
   * @returns what the action returned
   */
  const unchanged = async <T>(action: () => Promise<T>): Promise<T> => {
    const before = await snapshot()
    const result = await action()
    expect(await snapshot(), 'the database changed').toStrictEqual(before)

    return result
  }

  /**
   * Asserts that a request with an id of the other user ends exactly like the same request with an id nobody has: the
   * same `404`, the same body, and no write.
   *
   * @param send - the request, for a given id
   * @param foreignId - an id the other user owns
   * @param message - the expected `message` of the `404`, such as `Account not found`
   */
  const expectNotFound = async (
    send: (id: string) => request.Test,
    foreignId: string,
    message: string,
  ): Promise<void> => {
    const before = await snapshot()
    const foreign = await send(foreignId)
    const missing = await send(randomUUID())

    const foreignBody: unknown = foreign.body
    const missingBody: unknown = missing.body

    expect(await snapshot(), 'the database changed').toStrictEqual(before)
    expect(foreignBody).toStrictEqual({ statusCode: 404, error: 'Not Found', message })
    expect(foreign.status).toBe(404)
    expect([missing.status, missingBody]).toStrictEqual([foreign.status, foreignBody])
  }

  beforeAll(async () => {
    // Before the first TRUNCATE: nothing but a test database is ever emptied.
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    testDatabase(process.env.DATABASE_URL)

    const moduleRef = await Test.createTestingModule({ imports: [AppModule, ...imports] }).compile()

    app = moduleRef.createNestApplication({ logger: false })
    configureApp(app)
    // The line `main.ts` has (ADR 0011): without it the app has no authentication. Every spec file asserts a 401.
    app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector), app.get(AuthTokensService)))
    await app.init()

    prisma = app.get(PrismaService)
    tokens = app.get(AuthTokensService)
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(async () => {
    errorsExpected = false
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {
      // collected and asserted in `afterEach`
    })

    await prisma.$executeRawUnsafe('TRUNCATE TABLE "Transaction", "Account", "Category", "User"')
    world = await seedWorld(prisma, issueToken)
  })

  afterEach(() => {
    const logged = error.mock.calls

    vi.restoreAllMocks()
    vi.useRealTimers()
    vi.unstubAllEnvs()

    if (!errorsExpected) {
      expect(logged, 'an error was logged: an unexpected 500?').toStrictEqual([])
    }
  })

  return {
    /** Requests as `persona`, with its token. */
    as: (persona: Pick<Persona, 'token'>): Client => client(`Bearer ${persona.token}`),
    /** Requests without a token. */
    anonymous: (): Client => client(),
    /** The two users of the current test. */
    world: (): World => world,
    /** The client of the app, on the test database. */
    prisma: (): PrismaService => prisma,
    /** The app, for its providers. */
    app: (): INestApplication => app,
    /** A new access token for a user, signed with the current clock. */
    issueToken,
    snapshot,
    unchanged,
    expectNotFound,
    /** The current test expects an error in the log (a `500` on purpose). */
    expectErrors: (): void => {
      errorsExpected = true
    },
  }
}
