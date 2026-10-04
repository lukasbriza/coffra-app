import { describe, expect, it } from 'vitest'

import { AUTH_CHECKS_TTL_SECONDS } from '../../../../../src/modules/core/auth/constants'
import { useQuietWarnings } from '../use-quiet-warnings'

import { checks, jwt, service } from './setup'

describe('AuthChecksService.sign', () => {
  useQuietWarnings()

  it('hands the checks back unchanged after signing', async () => {
    const token = await service.sign(checks)

    await expect(service.verify(token)).resolves.toEqual(checks)
  })

  it('signs a token that expires with the login window', async () => {
    const token = await service.sign(checks)
    const { iat, exp } = jwt.decode<{ iat: number; exp: number }>(token)

    expect(exp - iat).toBe(AUTH_CHECKS_TTL_SECONDS)
  })
})
