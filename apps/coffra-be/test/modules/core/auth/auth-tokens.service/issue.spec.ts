import { describe, expect, it } from 'vitest'

import { useQuietWarnings } from '../use-quiet-warnings'

import {
  ACCESS_SECRET,
  ACCESS_TTL,
  decode,
  jwt,
  nowSeconds,
  REFRESH_SECRET,
  REFRESH_TTL,
  service,
  USER_ID,
} from './setup'

describe('AuthTokensService.issue', () => {
  useQuietWarnings()

  it('issues an access and a refresh token for the user and reports the access lifetime', async () => {
    const pair = await service.issue(USER_ID)

    expect(pair.expiresIn).toBe(ACCESS_TTL)
    expect(decode(pair.accessToken).sub).toBe(USER_ID)
    expect(decode(pair.refreshToken).sub).toBe(USER_ID)
  })

  it('carries nothing but the user id (no email, no roles)', async () => {
    const { accessToken, refreshToken } = await service.issue(USER_ID)

    for (const token of [accessToken, refreshToken]) {
      expect(Object.keys(decode(token)).toSorted()).toEqual(['exp', 'iat', 'sub'])
    }
  })

  it('gives each token its own lifetime from the config', async () => {
    const { accessToken, refreshToken } = await service.issue(USER_ID)

    expect(decode(accessToken).exp - decode(accessToken).iat).toBe(ACCESS_TTL)
    expect(decode(refreshToken).exp - decode(refreshToken).iat).toBe(REFRESH_TTL)
  })

  it('ends the refresh token at the given time and leaves the access token its own lifetime', async () => {
    const refreshExpiresAt = nowSeconds() + 3600

    const { accessToken, refreshToken } = await service.issue(USER_ID, refreshExpiresAt)

    expect(decode(refreshToken).exp).toBe(refreshExpiresAt)
    expect(decode(accessToken).exp - decode(accessToken).iat).toBe(ACCESS_TTL)
  })

  it('signs the two tokens with different secrets', async () => {
    const { accessToken, refreshToken } = await service.issue(USER_ID)

    await expect(jwt.verifyAsync(accessToken, { secret: ACCESS_SECRET })).resolves.toBeDefined()
    await expect(jwt.verifyAsync(refreshToken, { secret: REFRESH_SECRET })).resolves.toBeDefined()
    await expect(jwt.verifyAsync(accessToken, { secret: REFRESH_SECRET })).rejects.toThrow()
    await expect(jwt.verifyAsync(refreshToken, { secret: ACCESS_SECRET })).rejects.toThrow()
  })
})
