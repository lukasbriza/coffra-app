import { UnauthorizedException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import { useQuietWarnings } from '../use-quiet-warnings'

import { ACCESS_TTL, CHECKS_SECRET, jwt, service, USER_ID } from './setup'

describe('AuthTokensService.verifyAccess', () => {
  useQuietWarnings()

  it('returns the user an access token was issued to', async () => {
    const { accessToken } = await service.issue(USER_ID)

    await expect(service.verifyAccess(accessToken)).resolves.toEqual({ userId: USER_ID })
  })

  it('rejects a refresh token', async () => {
    const { refreshToken } = await service.issue(USER_ID)

    await expect(service.verifyAccess(refreshToken)).rejects.toThrow(UnauthorizedException)
  })

  it('rejects the login checks cookie, which has its own secret', async () => {
    const cookie = await jwt.signAsync({ sub: USER_ID }, { secret: CHECKS_SECRET, algorithm: 'HS256', expiresIn: 600 })

    await expect(service.verifyAccess(cookie)).rejects.toThrow(UnauthorizedException)
  })

  it('rejects an expired token', async () => {
    const { accessToken } = await service.issue(USER_ID)

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + (ACCESS_TTL + 1) * 1000)

    await expect(service.verifyAccess(accessToken)).rejects.toThrow(UnauthorizedException)
  })

  it('still accepts a token one second before it expires', async () => {
    const { accessToken } = await service.issue(USER_ID)

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + (ACCESS_TTL - 1) * 1000)

    await expect(service.verifyAccess(accessToken)).resolves.toEqual({ userId: USER_ID })
  })
})
