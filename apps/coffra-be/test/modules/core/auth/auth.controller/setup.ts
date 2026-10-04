import 'reflect-metadata'

import { type INestApplication, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'
import { afterEach, beforeEach, vi } from 'vitest'

import { configureApp } from '../../../../../src/app.setup'
import { AUTH_PROVIDER, type AuthChecks, type AuthProviderInterface } from '../../../../../src/modules/core'
import { AuthChecksService } from '../../../../../src/modules/core/auth/auth-checks.service'
import { AuthTokensService } from '../../../../../src/modules/core/auth/auth-tokens.service'
import { AuthController } from '../../../../../src/modules/core/auth/auth.controller'
import { AuthService } from '../../../../../src/modules/core/auth/auth.service'
import { AUTH_CHECKS_COOKIE } from '../../../../../src/modules/core/auth/constants'
import type { TokenPair } from '../../../../../src/modules/core/auth/types'
import { UsersService } from '../../../../../src/modules/core/users/users.service'
import { AuthSource, type User } from '../../../../../src/modules/prisma'

// Shared by the use case specs of `AuthController` (one file per endpoint).

export const SUBJECT = 'dde84b4e-03ed-4990-a23b-e1be2e5eaf1a'
export const AUTHORIZATION_URL = 'http://localhost:8080/realms/coffra/protocol/openid-connect/auth?state=expected-state'
export const REDIRECT_URI = 'http://localhost:3000/api/auth/callback'
export const END_SESSION_URL = 'http://localhost:8080/realms/coffra/protocol/openid-connect/logout?client_id=coffra-be'
export const checks: AuthChecks = {
  state: 'expected-state',
  nonce: 'expected-nonce',
  codeVerifier: 'expected-verifier',
}

export const user: User = {
  id: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11',
  email: 'dev@coffra.local',
  authSource: AuthSource.oidc,
  externalSubject: SUBJECT,
  createdAt: new Date('2026-10-03T08:00:00Z'),
  updatedAt: new Date('2026-10-03T08:00:00Z'),
}

export const setCookies = (response: request.Response): string[] =>
  (response.headers['set-cookie'] ?? []) as unknown as string[]
export const checksCookie = (response: request.Response): string | undefined =>
  setCookies(response).find((cookie) => cookie.startsWith(`${AUTH_CHECKS_COOKIE}=`))

/** `name=value` part of a `Set-Cookie` header, what a browser sends back. */
const cookiePair = (setCookie: string): string => setCookie.split(';', 1)[0] ?? ''

/**
 * Boots the controller with a mocked identity provider and users service, and the real services and token
 * signing. Call it inside a `describe`: it registers the `beforeEach` and `afterEach` for that block.
 */
export const useAuthController = () => {
  const provider = {
    login: vi.fn<AuthProviderInterface['login']>(),
    validateSession: vi.fn<AuthProviderInterface['validateSession']>(),
    getUserInfo: vi.fn<AuthProviderInterface['getUserInfo']>(),
    logout: vi.fn<AuthProviderInterface['logout']>(),
  }
  const upsertByExternalSubject = vi.fn<UsersService['upsertByExternalSubject']>()
  const findById = vi.fn<UsersService['findById']>()
  let app: INestApplication

  const server = (): App => app.getHttpServer() as App

  const createApp = async (nodeEnv: string): Promise<INestApplication> => {
    const values: Record<string, unknown> = {
      NODE_ENV: nodeEnv,
      AUTH_CHECKS_SECRET: 'checks-secret-with-at-least-32-chars',
      JWT_ACCESS_SECRET: 'access-secret-with-at-least-32-chars',
      JWT_REFRESH_SECRET: 'refresh-secret-with-at-least-32-chars',
      JWT_ACCESS_TTL_SECONDS: 900,
      JWT_REFRESH_TTL_SECONDS: 2_592_000,
    }
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [AuthController],
      providers: [
        AuthService,
        AuthChecksService,
        AuthTokensService,
        { provide: AUTH_PROVIDER, useValue: provider },
        { provide: UsersService, useValue: { upsertByExternalSubject, findById } },
        { provide: ConfigService, useValue: { get: (key: string) => values[key] } },
      ],
    }).compile()

    const created = moduleRef.createNestApplication()
    configureApp(created)
    await created.init()
    return created
  }

  /** Replaces the running app, e.g. to run it with another `NODE_ENV`. */
  const restart = async (nodeEnv: string): Promise<void> => {
    await app.close()
    app = await createApp(nodeEnv)
  }

  /** Runs `login` and returns the `name=value` cookie a browser would send to the callback. */
  const loginCookie = async (): Promise<string> => {
    const response = await request(server()).get('/api/auth/login').expect(302)
    return cookiePair(checksCookie(response) ?? '')
  }

  /** Runs a whole login (`login`, then the callback with its cookie) and returns the issued session. */
  const login = async (): Promise<TokenPair> => {
    const cookie = await loginCookie()
    const response = await request(server())
      .get('/api/auth/callback?code=one-time-code&state=expected-state')
      .set('Cookie', cookie)
      .expect(200)

    return response.body as TokenPair
  }

  const refresh = (body: unknown): request.Test =>
    request(server())
      .post('/api/auth/refresh')
      .send(body as object)

  const validateSessionCall = (): Parameters<AuthProviderInterface['validateSession']> => {
    const call = provider.validateSession.mock.calls.at(-1)
    if (!call) {
      throw new Error('validateSession was not called')
    }
    return call
  }

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {
      // keeps expected warnings out of the test output
    })
    provider.login.mockReset().mockResolvedValue({ authorizationUrl: AUTHORIZATION_URL, checks })
    provider.validateSession
      .mockReset()
      .mockResolvedValue({ subject: SUBJECT, email: user.email, accessToken: 'idp-access-token' })
    provider.getUserInfo.mockReset()
    provider.logout.mockReset().mockResolvedValue({ endSessionUrl: END_SESSION_URL })
    upsertByExternalSubject.mockReset().mockResolvedValue(user)
    findById.mockReset().mockResolvedValue(user)

    app = await createApp('development')
  })

  afterEach(async () => {
    await app.close()
    vi.restoreAllMocks()
  })

  return {
    provider,
    upsertByExternalSubject,
    findById,
    server,
    /** The running app, e.g. for `get(AuthTokensService)`. */
    application: (): INestApplication => app,
    restart,
    loginCookie,
    login,
    refresh,
    validateSessionCall,
  }
}
