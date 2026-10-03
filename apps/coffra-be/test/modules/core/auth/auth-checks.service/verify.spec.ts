import { UnauthorizedException } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import { AUTH_CHECKS_TTL_SECONDS } from '../../../../../src/modules/core/auth/auth.constants'
import { useQuietWarnings } from '../use-quiet-warnings'

import { ACCESS_SECRET, base64Url, checks, CHECKS_SECRET, jwt, service } from './setup'

describe('AuthChecksService.verify', () => {
  const { warn } = useQuietWarnings()

  it.each([undefined, ''])('rejects a missing token (%j)', async (token) => {
    await expect(service.verify(token)).rejects.toThrow(UnauthorizedException)
  })

  it('rejects a token that expired', async () => {
    const token = await service.sign(checks)

    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + (AUTH_CHECKS_TTL_SECONDS + 1) * 1000)

    await expect(service.verify(token)).rejects.toThrow(UnauthorizedException)
  })

  it('rejects a token with a modified payload', async () => {
    const token = await service.sign(checks)
    const [header, , signature] = token.split('.')
    const forged = [header, base64Url({ ...checks, state: 'attacker-state' }), signature].join('.')

    await expect(service.verify(forged)).rejects.toThrow(UnauthorizedException)
  })

  it('rejects a token signed with another secret, e.g. the access secret', async () => {
    const token = await jwt.signAsync({ ...checks }, { secret: ACCESS_SECRET, expiresIn: 60 })

    await expect(service.verify(token)).rejects.toThrow(UnauthorizedException)
  })

  it('rejects an unsigned token', async () => {
    const unsigned = `${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url({ ...checks, exp: 4_102_444_800 })}.`

    await expect(service.verify(unsigned)).rejects.toThrow(UnauthorizedException)
  })

  it('rejects a token signed with another algorithm', async () => {
    const token = await jwt.signAsync({ ...checks }, { secret: CHECKS_SECRET, algorithm: 'HS512', expiresIn: 60 })

    await expect(service.verify(token)).rejects.toThrow(UnauthorizedException)
  })

  it.each(['state', 'nonce', 'codeVerifier'] as const)('rejects a token without %s', async (field) => {
    const { [field]: _omitted, ...rest } = checks
    const token = await jwt.signAsync(rest, { secret: CHECKS_SECRET, expiresIn: 60 })

    await expect(service.verify(token)).rejects.toThrow(UnauthorizedException)
  })

  it('rejects a token with a non-string field', async () => {
    const token = await jwt.signAsync({ ...checks, nonce: 42 }, { secret: CHECKS_SECRET, expiresIn: 60 })

    await expect(service.verify(token)).rejects.toThrow(UnauthorizedException)
  })

  it('answers with a generic message and never logs the token or the secret', async () => {
    const token = await service.sign(checks)
    const forged = `${token}x`

    const error = await service.verify(forged).catch((error_: unknown) => error_)

    expect(error).toBeInstanceOf(UnauthorizedException)
    expect((error as UnauthorizedException).message).toBe('Login session missing or expired')
    expect(warn).toHaveBeenCalledOnce()
    const logged = JSON.stringify(warn.mock.calls)
    expect(logged).not.toContain(forged)
    expect(logged).not.toContain(CHECKS_SECRET)
    expect(logged).not.toContain(checks.codeVerifier)
  })
})
