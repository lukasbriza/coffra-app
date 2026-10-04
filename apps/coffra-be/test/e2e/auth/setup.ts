import 'reflect-metadata'

import { type INestApplication, Logger } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'
import { afterAll, afterEach, beforeAll, beforeEach, expect, type MockInstance, vi } from 'vitest'

import { configureApp } from '../../../src/app.setup'
import type { TokenPair } from '../../../src/modules/core/auth/types'
import { useQuietWarnings } from '../../modules/core/auth/use-quiet-warnings'
import { CLIENT_ID, CLIENT_SECRET, FakeIdp, REDIRECT_URI } from '../support/fake-idp'
import { InMemoryPrisma } from '../support/in-memory-prisma'

// Shared by the e2e specs of the auth flow: the real `AppModule` (config validation, every module, the global
// guard line of `main.ts`) against a fake identity provider on loopback and an in-memory user table. No Docker,
// no `.env`, no fixed port.

export type Browser = ReturnType<typeof request.agent>

export const ACCESS_TTL_SECONDS = 900
export const REFRESH_TTL_SECONDS = 2_592_000
/** The login cookie lives 10 minutes (`AUTH_CHECKS_TTL_SECONDS`). */
export const CHECKS_TTL_SECONDS = 600
export const CHECKS_SECRET = 'e2e-checks-secret-with-at-least-32-chars'
export const REFRESH_SECRET = 'e2e-refresh-secret-with-at-least-32-chars'

const ENV: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '3000',
  DATABASE_URL: 'postgresql://e2e:e2e@127.0.0.1:1/e2e', // never connected: the database is `InMemoryPrisma`
  OIDC_CLIENT_ID: CLIENT_ID,
  OIDC_CLIENT_SECRET: CLIENT_SECRET,
  OIDC_REDIRECT_URI: REDIRECT_URI,
  JWT_ACCESS_SECRET: 'e2e-access-secret-with-at-least-32-chars',
  JWT_REFRESH_SECRET: REFRESH_SECRET,
  AUTH_CHECKS_SECRET: CHECKS_SECRET,
  JWT_ACCESS_TTL_SECONDS: String(ACCESS_TTL_SECONDS),
  JWT_REFRESH_TTL_SECONDS: String(REFRESH_TTL_SECONDS),
}

/**
 * Everything from `src` that reaches `modules/config` is imported here, after the environment is set:
 * `ConfigModule.forRoot` validates the environment when that module is first imported, and the issuer is only
 * known once the fake IdP listens. Nothing else in the e2e files may import such a module statically.
 */
const loadApp = async () => {
  const { AppModule } = await import('../../../src/app.module.js')
  const { AuthTokensService, JwtAuthGuard } = await import('../../../src/modules/core/index.js')
  const { PrismaService } = await import('../../../src/modules/prisma/index.js')

  return { AppModule, AuthTokensService, JwtAuthGuard, PrismaService }
}

/** The `name=value` part of the login cookie in a `Set-Cookie` header, what a browser sends back. */
export const checksCookiePair = (response: request.Response): string | undefined =>
  ((response.headers['set-cookie'] ?? []) as unknown as string[])
    .find((cookie) => cookie.startsWith('coffra_oidc_checks='))
    ?.split(';', 1)[0]

/** Claims of a JWT, without verifying anything. */
export const claimsOf = (token: string): Record<string, unknown> =>
  JSON.parse(Buffer.from(token.split('.', 2)[1] ?? '', 'base64url').toString('utf8')) as Record<string, unknown>

/** Step 1 of a login, `GET /api/auth/login`: the URL the app sends the browser to and the cookie it sets. */
const startLogin = async (as: Browser): Promise<{ authorizationUrl: string; checksCookie: string }> => {
  const response = await as.get('/api/auth/login').expect(302)

  return {
    authorizationUrl: response.headers.location,
    checksCookie: checksCookiePair(response) ?? '',
  }
}

/** Step 2, the browser at the IdP: the callback URL it is redirected to, as the IdP built it. */
const authorize = async (authorizationUrl: string): Promise<URL> => {
  const response = await fetch(authorizationUrl, { redirect: 'manual' })
  if (response.status !== 302) {
    throw new Error(`The fake IdP rejected the authorization request: ${response.status} ${await response.text()}`)
  }

  return new URL(response.headers.get('location') ?? '')
}

/** Step 3, the browser follows the redirect: the redirect URI is the app under test, so only path and query matter. */
const callback = (as: Browser, callbackUrl: URL): request.Test => as.get(`${callbackUrl.pathname}${callbackUrl.search}`)

/**
 * Moves the clock forward, `Date` only (timers and sockets stay real). The fake IdP shares the process: what it
 * signs afterwards carries the moved time too, so sign first and travel after.
 */
const travel = (seconds: number): void => {
  if (!vi.isFakeTimers()) {
    vi.useFakeTimers({ toFake: ['Date'] })
  }
  vi.setSystemTime(Date.now() + seconds * 1000)
}

/**
 * Boots the app against the fake IdP. Call it inside a `describe`: it registers the hooks for that block (IdP and
 * environment once, a fresh app and user table for every test) and returns the helpers of the specs.
 */
export const useAuthApp = () => {
  const { warn } = useQuietWarnings()
  let error: MockInstance<Logger['error']>
  let idp: FakeIdp
  let prisma: InMemoryPrisma
  let app: INestApplication
  let loaded: Awaited<ReturnType<typeof loadApp>>

  const server = (): App => app.getHttpServer() as App

  /** A browser: its own cookie jar, like the one session of a real user. */
  const browser = (): Browser => request.agent(server())

  /** Step 3 from a client without a cookie jar, with exactly the `Cookie` header the spec gives it (or none). */
  const callbackWithCookie = (callbackUrl: URL, cookie?: string): request.Test => {
    const call = request(server()).get(`${callbackUrl.pathname}${callbackUrl.search}`)

    return cookie === undefined ? call : call.set('Cookie', cookie)
  }

  /** A whole login, whatever the outcome. */
  const attemptLogin = async (as: Browser = browser()) => {
    const { authorizationUrl, checksCookie } = await startLogin(as)
    const callbackUrl = await authorize(authorizationUrl)
    const response = await callback(as, callbackUrl)

    return { browser: as, authorizationUrl, checksCookie, callbackUrl, response }
  }

  /** A whole login that has to succeed: the issued session. */
  const login = async (as: Browser = browser()) => {
    const attempt = await attemptLogin(as)
    expect(attempt.response.status, JSON.stringify(attempt.response.body)).toBe(200)

    return { ...attempt, tokens: attempt.response.body as TokenPair }
  }

  const me = (accessToken?: string): request.Test => {
    const call = request(server()).get('/api/users/me')

    return accessToken === undefined ? call : call.set('Authorization', `Bearer ${accessToken}`)
  }

  const refresh = (body: unknown, authorization?: string): request.Test => {
    const call = request(server())
      .post('/api/auth/refresh')
      .send(body as object)

    return authorization === undefined ? call : call.set('Authorization', authorization)
  }

  beforeAll(async () => {
    idp = await FakeIdp.start()
    for (const [name, value] of Object.entries({ ...ENV, OIDC_ISSUER_URL: idp.issuer })) {
      vi.stubEnv(name, value)
    }
    loaded = await loadApp()
  })

  afterAll(async () => {
    await idp.stop()
    vi.unstubAllEnvs()
  })

  beforeEach(async () => {
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {
      // keeps the expected errors (a provider that is down) out of the test output
    })
    idp.reset()
    prisma = new InMemoryPrisma()

    const moduleRef = await Test.createTestingModule({ imports: [loaded.AppModule] })
      .overrideProvider(loaded.PrismaService)
      .useValue(prisma)
      .compile()

    app = moduleRef.createNestApplication()
    configureApp(app)
    // The line `main.ts` has (ADR 0011): without it the app has no authentication. `protected-routes.spec.ts` fails then.
    app.useGlobalGuards(new loaded.JwtAuthGuard(app.get(Reflector), app.get(loaded.AuthTokensService)))
    await app.init()
  })

  afterEach(async () => {
    await app.close()
    error.mockRestore()
  })

  return {
    warn,
    error: (): typeof error => error,
    idp: (): FakeIdp => idp,
    prisma: (): InMemoryPrisma => prisma,
    server,
    browser,
    startLogin,
    authorize,
    callback,
    callbackWithCookie,
    attemptLogin,
    login,
    me,
    refresh,
    travel,
  }
}
