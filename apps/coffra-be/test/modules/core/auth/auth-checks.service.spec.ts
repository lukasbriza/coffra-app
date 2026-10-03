import 'reflect-metadata'

import { Logger, UnauthorizedException } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Env } from '../../../../src/modules/config'
import { AuthChecksService } from '../../../../src/modules/core/auth/auth-checks.service'
import { AUTH_CHECKS_TTL_SECONDS } from '../../../../src/modules/core/auth/auth.constants'
import type { AuthChecks } from '../../../../src/modules/core/auth/types'

const CHECKS_SECRET = 'checks-secret-with-at-least-32-chars'
const ACCESS_SECRET = 'access-secret-with-at-least-32-chars'

const checks: AuthChecks = { state: 'expected-state', nonce: 'expected-nonce', codeVerifier: 'expected-verifier' }

const configService = { get: () => CHECKS_SECRET } as unknown as ConfigService<Env, true>
const jwt = new JwtService()
const service = new AuthChecksService(jwt, configService)

const base64Url = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url')

describe('AuthChecksService', () => {
  const warn = vi.spyOn(Logger.prototype, 'warn')

  beforeEach(() => {
    warn.mockReset().mockImplementation(() => {
      // keeps expected warnings out of the test output
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('hands the checks back unchanged after signing', async () => {
    const token = await service.sign(checks)

    await expect(service.verify(token)).resolves.toEqual(checks)
  })

  it('signs a token that expires with the login window', async () => {
    const token = await service.sign(checks)
    const { iat, exp } = jwt.decode<{ iat: number; exp: number }>(token)

    expect(exp - iat).toBe(AUTH_CHECKS_TTL_SECONDS)
  })

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
