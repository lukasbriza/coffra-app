import { describe, expect, it } from 'vitest'

import {
  ACCESS_SECRET,
  base64Url,
  CHECKS_SECRET,
  handler,
  nowSeconds,
  REFRESH_SECRET,
  REJECTION_MESSAGE,
  useJwtAuthGuard,
  USER_ID,
} from './setup'

describe('JwtAuthGuard with a missing or invalid access token', () => {
  const { get, jwt, warn } = useJwtAuthGuard()

  const sign = (secret: string, extra: { algorithm?: 'HS512'; exp?: number } = {}): Promise<string> =>
    extra.exp === undefined
      ? jwt().signAsync(
          { sub: USER_ID },
          { secret, expiresIn: 900, ...(extra.algorithm && { algorithm: extra.algorithm }) },
        )
      : jwt().signAsync({ sub: USER_ID, exp: extra.exp }, { secret })

  const cases: [string, () => Promise<string | undefined>][] = [
    ['no Authorization header', () => Promise.resolve(undefined)],
    ['another scheme', () => Promise.resolve('Basic dXNlcjpwYXNz')],
    ['the scheme without a token', () => Promise.resolve('Bearer')],
    ['a token that is not a JWT', () => Promise.resolve('Bearer not-a-jwt')],
    ['an expired token', async () => `Bearer ${await sign(ACCESS_SECRET, { exp: nowSeconds() - 10 })}`],
    [
      'a token signed with a foreign secret',
      async () => `Bearer ${await sign('foreign-secret-with-at-least-32-chars')}`,
    ],
    ['a refresh token', async () => `Bearer ${await sign(REFRESH_SECRET)}`],
    ['the login checks cookie token', async () => `Bearer ${await sign(CHECKS_SECRET)}`],
    ['a token with another algorithm', async () => `Bearer ${await sign(ACCESS_SECRET, { algorithm: 'HS512' })}`],
    [
      'an unsigned token (alg none)',
      () =>
        Promise.resolve(
          `Bearer ${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url({ sub: USER_ID, exp: nowSeconds() + 900 })}.`,
        ),
    ],
    [
      'a signed token without a user',
      async () => `Bearer ${await jwt().signAsync({}, { secret: ACCESS_SECRET, expiresIn: 900 })}`,
    ],
  ]

  it.each(cases)('answers 401 for %s', async (_name, authorization) => {
    const response = await get('/api/probe', await authorization()).expect(401)

    expect((response.body as { message: string }).message).toBe(REJECTION_MESSAGE)
    expect(response.headers['www-authenticate']).toBe('Bearer')
  })

  it('never runs the handler for a rejected request', async () => {
    await get('/api/probe', 'Bearer not-a-jwt').expect(401)
    await get('/api/probe').expect(401)

    expect(handler).not.toHaveBeenCalled()
  })

  it('rejects before the body is validated: a bad token with a bad body is a 401, not a 400', async () => {
    await get('/api/probe', 'Bearer not-a-jwt').send({ nonsense: true }).expect(401)
  })

  it('keeps the token out of the response and the log', async () => {
    const token = await sign('foreign-secret-with-at-least-32-chars')

    const response = await get('/api/probe', `Bearer ${token}`).expect(401)

    expect(response.text).not.toContain(token)
    expect(JSON.stringify(warn.mock.calls)).not.toContain(token)
  })
})
