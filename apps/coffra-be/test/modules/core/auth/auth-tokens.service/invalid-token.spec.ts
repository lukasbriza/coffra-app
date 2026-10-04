import { UnauthorizedException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { useQuietWarnings } from '../use-quiet-warnings'

import { ACCESS_SECRET, base64Url, jwt, nowSeconds, REFRESH_SECRET, service, USER_ID } from './setup'

// What `verifyAccess` and `verifyRefresh` must both refuse, whatever the token claims to be.
describe.each([
  ['access', 'verifyAccess', ACCESS_SECRET],
  ['refresh', 'verifyRefresh', REFRESH_SECRET],
] as const)('AuthTokensService: an invalid %s token', (kind, method, secret) => {
  const { warn } = useQuietWarnings()

  const verify = (token: string | undefined) => service[method](token)
  const issued = async (): Promise<string> => {
    const pair = await service.issue(USER_ID)
    return kind === 'access' ? pair.accessToken : pair.refreshToken
  }

  it.each([undefined, ''])('rejects a missing token (%j)', async (token) => {
    await expect(verify(token)).rejects.toThrow(UnauthorizedException)
  })

  it('rejects garbage', async () => {
    await expect(verify('not-a-jwt')).rejects.toThrow(UnauthorizedException)
  })

  it('rejects a modified payload', async () => {
    const token = await issued()
    const [header, , signature] = token.split('.')
    const forged = [header, base64Url({ sub: 'attacker', iat: nowSeconds(), exp: nowSeconds() + 60 }), signature].join(
      '.',
    )

    await expect(verify(forged)).rejects.toThrow(UnauthorizedException)
  })

  it('rejects a token signed with another secret', async () => {
    const foreign = await jwt.signAsync(
      { sub: USER_ID },
      { secret: 'foreign-secret-with-at-least-32-chars', algorithm: 'HS256', expiresIn: 60 },
    )

    await expect(verify(foreign)).rejects.toThrow(UnauthorizedException)
  })

  it('rejects an unsigned token (alg none)', async () => {
    const unsigned = `${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url({ sub: USER_ID, exp: nowSeconds() + 60 })}.`

    await expect(verify(unsigned)).rejects.toThrow(UnauthorizedException)
  })

  it('rejects another algorithm even with the right secret', async () => {
    const hs512 = await jwt.signAsync({ sub: USER_ID }, { secret, algorithm: 'HS512', expiresIn: 60 })

    await expect(verify(hs512)).rejects.toThrow(UnauthorizedException)
  })

  it.each([
    ['no subject', { other: 'claim' }],
    ['an empty subject', { sub: '' }],
    ['a non-string subject', { sub: 42 }],
  ])('rejects a validly signed token with %s', async (_label, claims) => {
    const token = await jwt.signAsync(claims, { secret, algorithm: 'HS256', expiresIn: 60 })

    await expect(verify(token)).rejects.toThrow(UnauthorizedException)
  })

  it('rejects a validly signed token that never expires', async () => {
    const token = await jwt.signAsync({ sub: USER_ID }, { secret, algorithm: 'HS256' })

    await expect(verify(token)).rejects.toThrow(UnauthorizedException)
  })

  it('answers every failure the same and never echoes the token or a secret', async () => {
    const token = await issued()
    const [header, payload] = token.split('.')
    const tampered = `${header}.${payload}.${'A'.repeat(43)}`

    const failures = await Promise.all(
      [undefined, 'not-a-jwt', tampered].map((candidate) => verify(candidate).catch((error: unknown) => error)),
    )

    for (const failure of failures) {
      expect(failure).toBeInstanceOf(UnauthorizedException)
      expect((failure as UnauthorizedException).message).toBe(`Invalid or expired ${kind} token`)
    }
    const logged = JSON.stringify(warn.mock.calls)
    expect(warn).toHaveBeenCalledTimes(3)
    expect(logged).not.toContain(tampered)
    expect(logged).not.toContain(secret)
  })
})
