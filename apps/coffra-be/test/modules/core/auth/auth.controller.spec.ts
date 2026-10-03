import 'reflect-metadata'

import { type INestApplication, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { configureApp } from '../../../../src/app.setup'
import { AUTH_PROVIDER, type AuthChecks, type AuthProviderInterface } from '../../../../src/modules/core'
import { AuthChecksService } from '../../../../src/modules/core/auth/auth-checks.service'
import { AUTH_CHECKS_COOKIE, AUTH_CHECKS_TTL_SECONDS } from '../../../../src/modules/core/auth/auth.constants'
import { AuthController } from '../../../../src/modules/core/auth/auth.controller'
import { AuthService } from '../../../../src/modules/core/auth/auth.service'
import { UsersService } from '../../../../src/modules/core/users/users.service'
import { AuthSource, type User } from '../../../../src/modules/prisma'

const SUBJECT = 'dde84b4e-03ed-4990-a23b-e1be2e5eaf1a'
const AUTHORIZATION_URL = 'http://localhost:8080/realms/coffra/protocol/openid-connect/auth?state=expected-state'
const REDIRECT_URI = 'http://localhost:3000/api/auth/callback'
const checks: AuthChecks = { state: 'expected-state', nonce: 'expected-nonce', codeVerifier: 'expected-verifier' }

const user: User = {
  id: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11',
  email: 'dev@coffra.local',
  authSource: AuthSource.oidc,
  externalSubject: SUBJECT,
  createdAt: new Date('2026-10-03T08:00:00Z'),
  updatedAt: new Date('2026-10-03T08:00:00Z'),
}

const setCookies = (response: request.Response): string[] =>
  (response.headers['set-cookie'] ?? []) as unknown as string[]
const checksCookie = (response: request.Response): string | undefined =>
  setCookies(response).find((cookie) => cookie.startsWith(`${AUTH_CHECKS_COOKIE}=`))

/** `name=value` part of a `Set-Cookie` header, what a browser sends back. */
const cookiePair = (setCookie: string): string => setCookie.split(';', 1)[0] ?? ''

describe('AuthController', () => {
  const provider = {
    login: vi.fn<AuthProviderInterface['login']>(),
    validateSession: vi.fn<AuthProviderInterface['validateSession']>(),
    getUserInfo: vi.fn<AuthProviderInterface['getUserInfo']>(),
  }
  const upsertByExternalSubject = vi.fn<UsersService['upsertByExternalSubject']>()
  let app: INestApplication
  const server = (): App => app.getHttpServer() as App

  const createApp = async (nodeEnv: string): Promise<INestApplication> => {
    const values: Record<string, unknown> = {
      NODE_ENV: nodeEnv,
      AUTH_CHECKS_SECRET: 'checks-secret-with-at-least-32-chars',
    }
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [AuthController],
      providers: [
        AuthService,
        AuthChecksService,
        { provide: AUTH_PROVIDER, useValue: provider },
        { provide: UsersService, useValue: { upsertByExternalSubject } },
        { provide: ConfigService, useValue: { get: (key: string) => values[key] } },
      ],
    }).compile()

    const created = moduleRef.createNestApplication()
    configureApp(created)
    await created.init()
    return created
  }

  /** Runs `login` and returns the `name=value` cookie a browser would send to the callback. */
  const loginCookie = async (): Promise<string> => {
    const response = await request(server()).get('/api/auth/login').expect(302)
    return cookiePair(checksCookie(response) ?? '')
  }

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
    upsertByExternalSubject.mockReset().mockResolvedValue(user)

    app = await createApp('development')
  })

  afterEach(async () => {
    await app.close()
    vi.restoreAllMocks()
  })

  describe('GET /api/auth/login', () => {
    it('redirects to the identity provider', async () => {
      const response = await request(server()).get('/api/auth/login').expect(302)

      expect(response.headers.location).toBe(AUTHORIZATION_URL)
      expect(response.headers['cache-control']).toBe('no-store')
    })

    it('sets a short-lived, httpOnly, lax cookie scoped to the auth routes', async () => {
      const response = await request(server()).get('/api/auth/login')

      const cookie = checksCookie(response)
      expect(cookie).toBeDefined()
      expect(cookie).toContain('HttpOnly')
      expect(cookie).toContain('SameSite=Lax')
      expect(cookie).toContain('Path=/api/auth;')
      expect(cookie).toContain(`Max-Age=${AUTH_CHECKS_TTL_SECONDS}`)
      expect(cookie).not.toContain('Secure')
    })

    it('marks the cookie Secure in production', async () => {
      await app.close()
      app = await createApp('production')

      const response = await request(server()).get('/api/auth/login').expect(302)

      expect(checksCookie(response)).toContain('Secure')
    })

    it('sets no cookie when the identity provider is unavailable', async () => {
      provider.login.mockRejectedValue(new ServiceUnavailableException('Identity provider is unavailable'))

      const response = await request(server()).get('/api/auth/login').expect(503)

      expect(checksCookie(response)).toBeUndefined()
    })

    it('is not served without the api prefix', async () => {
      await request(server()).get('/auth/login').expect(404)
    })
  })

  describe('GET /api/auth/callback', () => {
    it('resolves the user and answers with its id and email only', async () => {
      const cookie = await loginCookie()

      const response = await request(server())
        .get('/api/auth/callback?code=one-time-code&state=expected-state')
        .set('Cookie', cookie)
        .expect(200)

      expect(response.body).toEqual({ userId: user.id, email: user.email })
      expect(JSON.stringify(response.body)).not.toContain(SUBJECT)
      expect(response.headers['cache-control']).toBe('no-store')
      expect(upsertByExternalSubject).toHaveBeenCalledExactlyOnceWith({ subject: SUBJECT, email: user.email })
    })

    it('hands the checks from the cookie and the callback query to the provider', async () => {
      const cookie = await loginCookie()

      await request(server())
        .get('/api/auth/callback?code=one-time-code&state=expected-state&iss=http%3A%2F%2Flocalhost%3A8080')
        .set('Cookie', cookie)
        .expect(200)

      const [params, receivedChecks] = validateSessionCall()
      expect(receivedChecks).toEqual(checks)
      expect(params.get('code')).toBe('one-time-code')
      expect(params.get('state')).toBe('expected-state')
      expect(params.get('iss')).toBe('http://localhost:8080')
    })

    it('passes repeated parameters through as sent instead of collapsing them', async () => {
      const cookie = await loginCookie()

      await request(server()).get('/api/auth/callback?code=a&code=b&state=expected-state').set('Cookie', cookie)

      expect(validateSessionCall()[0].getAll('code')).toEqual(['a', 'b'])
    })

    it('clears the single-use cookie after a successful callback', async () => {
      const cookie = await loginCookie()

      const response = await request(server())
        .get('/api/auth/callback?code=one-time-code&state=expected-state')
        .set('Cookie', cookie)

      const cleared = checksCookie(response)
      expect(cleared).toContain(`${AUTH_CHECKS_COOKIE}=;`)
      expect(cleared).toContain('Path=/api/auth')
      expect(cleared).toContain('Expires=Thu, 01 Jan 1970')
    })

    it('rejects a callback without the login cookie', async () => {
      const response = await request(server())
        .get('/api/auth/callback?code=one-time-code&state=expected-state')
        .expect(401)

      expect((response.body as { message: string }).message).toBe('Login session missing or expired')
      expect(provider.validateSession).not.toHaveBeenCalled()
      expect(upsertByExternalSubject).not.toHaveBeenCalled()
    })

    it('rejects a forged login cookie', async () => {
      const cookie = await loginCookie()
      const [name, value = ''] = cookie.split('=')
      // A character in the middle of the signature: the last one only carries padding bits and may not change it.
      const signatureStart = value.lastIndexOf('.') + 1
      const flipped = value[signatureStart + 4] === 'A' ? 'B' : 'A'
      const forged = `${name}=${value.slice(0, signatureStart + 4)}${flipped}${value.slice(signatureStart + 5)}`

      await request(server())
        .get('/api/auth/callback?code=one-time-code&state=expected-state')
        .set('Cookie', forged)
        .expect(401)

      expect(provider.validateSession).not.toHaveBeenCalled()
      expect(upsertByExternalSubject).not.toHaveBeenCalled()
    })

    it('rejects a callback the provider refuses, drops the cookie and creates no user', async () => {
      const cookie = await loginCookie()
      provider.validateSession.mockRejectedValue(new UnauthorizedException('Authentication failed'))

      const response = await request(server())
        .get('/api/auth/callback?code=one-time-code&state=wrong-state')
        .set('Cookie', cookie)
        .expect(401)

      expect((response.body as { message: string }).message).toBe('Authentication failed')
      expect(checksCookie(response)).toContain(`${AUTH_CHECKS_COOKIE}=;`)
      expect(upsertByExternalSubject).not.toHaveBeenCalled()
    })

    it('rejects an error response from the identity provider', async () => {
      const cookie = await loginCookie()
      provider.validateSession.mockRejectedValue(new UnauthorizedException('Authentication failed'))

      await request(server())
        .get('/api/auth/callback?error=access_denied&state=expected-state')
        .set('Cookie', cookie)
        .expect(401)

      expect(validateSessionCall()[0].get('error')).toBe('access_denied')
      expect(upsertByExternalSubject).not.toHaveBeenCalled()
    })

    it('answers 503 when the identity provider is unavailable', async () => {
      const cookie = await loginCookie()
      provider.validateSession.mockRejectedValue(new ServiceUnavailableException('Identity provider is unavailable'))

      await request(server())
        .get('/api/auth/callback?code=one-time-code&state=expected-state')
        .set('Cookie', cookie)
        .expect(503)

      expect(upsertByExternalSubject).not.toHaveBeenCalled()
    })

    it('is served at the redirect URI registered at the identity provider', async () => {
      const { pathname } = new URL(REDIRECT_URI)

      // 401 (no cookie) proves the route exists, 404 would mean the paths drifted apart.
      await request(server()).get(pathname).expect(401)
    })
  })
})
