import { ServiceUnavailableException } from '@nestjs/common'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { AUTH_CHECKS_TTL_SECONDS } from '../../../../../src/modules/core/auth/constants'

import { AUTHORIZATION_URL, checksCookie, useAuthController } from './setup'

describe('GET /api/auth/login', () => {
  const { provider, server, restart } = useAuthController()

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
    await restart('production')

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
