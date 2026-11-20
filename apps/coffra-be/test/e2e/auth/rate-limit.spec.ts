import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAuthApp } from './setup'

// The rate limit of the whole app: the real `AppModule` with the real guard (the other specs replace it), the global
// guard line of `main.ts`, the real `AuthController` and `HealthController`. The numbers are small on purpose.

const AUTH_MAX = 3
const MAX = 6

describe('the rate limit of the whole app', () => {
  const e2e = useAuthApp({
    rateLimited: true,
    env: { RATE_LIMIT_TTL_SECONDS: '60', RATE_LIMIT_MAX: String(MAX), RATE_LIMIT_AUTH_MAX: String(AUTH_MAX) },
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const login = (): request.Test => request(e2e.server()).get('/api/auth/login')
  const refresh = (): request.Test => request(e2e.server()).post('/api/auth/refresh').send({})
  const logout = (): request.Test => request(e2e.server()).post('/api/auth/logout')
  const protectedRoute = (): request.Test => e2e.me()

  const exhaustAuth = async (): Promise<void> => {
    for (let call = 0; call < AUTH_MAX; call += 1) {
      await login().expect(302)
    }
  }

  const exhaustGlobal = async (): Promise<void> => {
    for (let call = 0; call < MAX; call += 1) {
      await protectedRoute().expect(401)
    }
  }

  describe('on the login routes', () => {
    it('answers the first attempts and then turns the client away with 429 and a time to wait', async () => {
      await exhaustAuth()

      const response = await login().expect(429)

      expect(response.body).toStrictEqual({ statusCode: 429, message: 'ThrottlerException: Too Many Requests' })
      expect(Number(response.headers['retry-after'])).toBeGreaterThan(0)
    })

    it('counts login, callback, refresh and logout together', async () => {
      await login().expect(302)
      await refresh().expect(400)
      await logout().expect(200)

      await login().expect(429)
      await refresh().expect(429)
      await logout().expect(429)
      await request(e2e.server()).get('/api/auth/callback').expect(429)
    })

    it('lets a whole login through again after the window', async () => {
      await exhaustAuth()
      await login().expect(429)

      e2e.travel(61)

      const { tokens } = await e2e.login()

      expect(tokens.accessToken).toBeTruthy()
    })
  })

  describe('on the other routes', () => {
    it('does not count the login routes: they have a bucket of their own', async () => {
      await exhaustAuth()
      await login().expect(429)

      await protectedRoute().expect(401)
    })

    it('does not touch the login routes when the rest is used up', async () => {
      await exhaustGlobal()
      await protectedRoute().expect(429)

      await login().expect(302)
    })
  })

  describe('before the guard that checks the token', () => {
    it('counts the requests it turns away, so guessing tokens is limited too', async () => {
      await exhaustGlobal()

      const response = await protectedRoute().expect(429)

      expect(response.headers['www-authenticate']).toBeUndefined()
    })
  })

  describe('on the health probe', () => {
    it('is never limited, and does not use up the limit of the others', async () => {
      await exhaustGlobal()
      await protectedRoute().expect(429)

      for (let call = 0; call < MAX + 3; call += 1) {
        const response = await request(e2e.server()).get('/api/health')

        expect(response.status, 'the probe was limited').not.toBe(429)
        expect(response.headers['x-ratelimit-limit']).toBeUndefined()
      }
    })
  })
})
