import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { AuthTokensService } from '../../../../../src/modules/core/auth/auth-tokens.service'
import { AUTH_CHECKS_COOKIE } from '../../../../../src/modules/core/auth/constants'
import type { TokenPair } from '../../../../../src/modules/core/auth/types'

import { checks, checksCookie, REDIRECT_URI, SUBJECT, useAuthController, user } from './setup'

describe('GET /api/auth/callback', () => {
  const { provider, upsertByExternalSubject, server, application, loginCookie, login, validateSessionCall } =
    useAuthController()

  it('resolves the user and answers with the issued token pair only', async () => {
    const cookie = await loginCookie()

    const response = await request(server())
      .get('/api/auth/callback?code=one-time-code&state=expected-state')
      .set('Cookie', cookie)
      .expect(200)

    expect(Object.keys(response.body as object).toSorted()).toEqual(['accessToken', 'expiresIn', 'refreshToken'])
    expect((response.body as TokenPair).expiresIn).toBe(900)
    expect(JSON.stringify(response.body)).not.toContain(SUBJECT)
    expect(JSON.stringify(response.body)).not.toContain(user.email)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(upsertByExternalSubject).toHaveBeenCalledExactlyOnceWith({ subject: SUBJECT, email: user.email })
  })

  it('issues tokens that belong to the user who logged in', async () => {
    const { accessToken, refreshToken } = await login()
    const tokens = application().get(AuthTokensService)

    await expect(tokens.verifyAccess(accessToken)).resolves.toEqual({ userId: user.id })
    await expect(tokens.verifyRefresh(refreshToken)).resolves.toMatchObject({ userId: user.id })
  })

  it('issues no tokens when the callback is rejected', async () => {
    const cookie = await loginCookie()
    provider.validateSession.mockRejectedValue(new UnauthorizedException('Authentication failed'))

    const response = await request(server())
      .get('/api/auth/callback?code=one-time-code&state=wrong-state')
      .set('Cookie', cookie)
      .expect(401)

    expect(response.body).not.toHaveProperty('accessToken')
    expect(response.body).not.toHaveProperty('refreshToken')
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
