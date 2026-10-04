import { JwtService } from '@nestjs/jwt'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { AuthTokensService } from '../../../../../src/modules/core/auth/auth-tokens.service'
import type { TokenPair } from '../../../../../src/modules/core/auth/types'

import { setCookies, useAuthController, user } from './setup'

describe('POST /api/auth/refresh', () => {
  const { findById, server, application, login, refresh } = useAuthController()

  it('swaps a refresh token for a new pair', async () => {
    const first = await login()

    const response = await refresh({ refreshToken: first.refreshToken }).expect(200)

    const second = response.body as TokenPair
    expect(Object.keys(second).toSorted()).toEqual(['accessToken', 'expiresIn', 'refreshToken'])
    expect(second.expiresIn).toBe(900)
    expect(response.headers['cache-control']).toBe('no-store')
    await expect(application().get(AuthTokensService).verifyAccess(second.accessToken)).resolves.toEqual({
      userId: user.id,
    })
  })

  it('looks the user up by the id in the token', async () => {
    const { refreshToken } = await login()

    await refresh({ refreshToken }).expect(200)

    expect(findById).toHaveBeenCalledExactlyOnceWith(user.id)
  })

  it('ends the new refresh token when the old one would have, so the session cannot grow', async () => {
    const first = await login()
    const jwt = application().get(JwtService)

    const response = await refresh({ refreshToken: first.refreshToken }).expect(200)

    const exp = (token: string): number => jwt.decode<{ exp: number }>(token).exp
    expect(exp((response.body as TokenPair).refreshToken)).toBe(exp(first.refreshToken))
  })

  it('ignores properties other than the refresh token', async () => {
    const { refreshToken } = await login()

    await refresh({ refreshToken, userId: 'attacker' }).expect(200)

    expect(findById).toHaveBeenCalledExactlyOnceWith(user.id)
  })

  it.each([
    ['no body', undefined],
    ['an empty body', {}],
    ['an empty token', { refreshToken: '' }],
    ['a token that is not a string', { refreshToken: 123 }],
  ])('answers 400 for %s', async (_label, body) => {
    await refresh(body).expect(400)

    expect(findById).not.toHaveBeenCalled()
  })

  it('rejects a tampered refresh token', async () => {
    const { refreshToken } = await login()
    const [header, , signature] = refreshToken.split('.')
    const payload = Buffer.from(JSON.stringify({ sub: 'attacker', exp: 4_000_000_000 })).toString('base64url')

    const response = await refresh({ refreshToken: `${header}.${payload}.${signature}` }).expect(401)

    expect((response.body as { message: string }).message).toBe('Invalid or expired refresh token')
    expect(findById).not.toHaveBeenCalled()
  })

  it('rejects an access token', async () => {
    const { accessToken } = await login()

    await refresh({ refreshToken: accessToken }).expect(401)

    expect(findById).not.toHaveBeenCalled()
  })

  it('rejects a token for a user that no longer exists and issues nothing', async () => {
    const { refreshToken } = await login()
    findById.mockResolvedValue(null)

    const response = await refresh({ refreshToken }).expect(401)

    expect(response.body).not.toHaveProperty('accessToken')
    expect((response.body as { message: string }).message).toBe('Invalid or expired refresh token')
  })

  it('sets no cookie', async () => {
    const { refreshToken } = await login()

    const response = await refresh({ refreshToken }).expect(200)

    expect(setCookies(response)).toEqual([])
  })

  it('is POST only', async () => {
    await request(server()).get('/api/auth/refresh').expect(404)
  })
})
