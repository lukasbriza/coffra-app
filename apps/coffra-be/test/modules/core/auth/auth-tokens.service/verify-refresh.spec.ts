import { UnauthorizedException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import { useQuietWarnings } from '../use-quiet-warnings'

import { CHECKS_SECRET, decode, jwt, nowSeconds, REFRESH_TTL, service, USER_ID } from './setup'

describe('AuthTokensService.verifyRefresh', () => {
  useQuietWarnings()

  it('returns the user and when the token expires', async () => {
    const { refreshToken } = await service.issue(USER_ID)

    await expect(service.verifyRefresh(refreshToken)).resolves.toEqual({
      userId: USER_ID,
      expiresAt: decode(refreshToken).exp,
    })
  })

  it('rejects an access token', async () => {
    const { accessToken } = await service.issue(USER_ID)

    await expect(service.verifyRefresh(accessToken)).rejects.toThrow(UnauthorizedException)
  })

  it('rejects the login checks cookie, which has its own secret', async () => {
    const cookie = await jwt.signAsync({ sub: USER_ID }, { secret: CHECKS_SECRET, algorithm: 'HS256', expiresIn: 600 })

    await expect(service.verifyRefresh(cookie)).rejects.toThrow(UnauthorizedException)
  })

  it('rejects an expired token', async () => {
    const { refreshToken } = await service.issue(USER_ID)

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + (REFRESH_TTL + 1) * 1000)

    await expect(service.verifyRefresh(refreshToken)).rejects.toThrow(UnauthorizedException)
  })

  it('rejects a refresh token whose inherited expiry has passed', async () => {
    const { refreshToken } = await service.issue(USER_ID, nowSeconds() + 60)

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + 61 * 1000)

    await expect(service.verifyRefresh(refreshToken)).rejects.toThrow(UnauthorizedException)
  })
})
