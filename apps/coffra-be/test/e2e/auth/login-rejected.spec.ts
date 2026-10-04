import { JwtService } from '@nestjs/jwt'
import type request from 'supertest'
import { describe, expect, it } from 'vitest'

import { CHECKS_SECRET, CHECKS_TTL_SECONDS, REFRESH_SECRET, useAuthApp } from './setup'

// Every refusal below must leave the same traces: a generic 401 (nothing from the library or the identity provider
// in the body), no session, a cleared login cookie, no `User`, and the real reason in the log. The reason is part of
// the assertion: a spec that only saw a 401 could pass for the wrong reason (a broken fake IdP answers 401 too).

const noTampering = (): void => undefined

const now = (): number => Math.floor(Date.now() / 1000)

const PROVIDER_REJECTED = { message: 'Authentication failed', error: 'Unauthorized', statusCode: 401 }
const COOKIE_REJECTED = { message: 'Login session missing or expired', error: 'Unauthorized', statusCode: 401 }

const forgedCookie = (secret: string, payload: Record<string, unknown>): string =>
  `coffra_oidc_checks=${new JwtService().sign(payload, { secret, algorithm: 'HS256', expiresIn: CHECKS_TTL_SECONDS })}`

describe('a login that is refused', () => {
  const e2e = useAuthApp()

  const logged = (): string => e2e.warn.mock.calls.map(([message]) => String(message)).join('\n')

  const expectRefused = (
    response: request.Response,
    body: typeof PROVIDER_REJECTED,
    reason: string,
    users = 0,
  ): void => {
    expect(response.status).toBe(401)
    expect(response.body).toEqual(body)
    expect((response.headers['set-cookie'] as unknown as string[]).join('\n')).toMatch(/coffra_oidc_checks=;/)
    expect(e2e.prisma().users()).toHaveLength(users)
    expect(logged()).toContain(reason)
  }

  /** The login up to the callback, which the spec may tamper with before the browser follows it. */
  const callbackTampered = async (tamper: (callbackUrl: URL) => void): Promise<request.Response> => {
    const browser = e2e.browser()
    const { authorizationUrl } = await e2e.startLogin(browser)
    const callbackUrl = await e2e.authorize(authorizationUrl)
    tamper(callbackUrl)

    return e2e.callback(browser, callbackUrl)
  }

  /** A login up to the callback URL, in a browser of its own: the cookie it set stays behind. */
  const freshCallbackUrl = async (): Promise<URL> => {
    const { authorizationUrl } = await e2e.startLogin(e2e.browser())

    return e2e.authorize(authorizationUrl)
  }

  describe('because of the callback parameters', () => {
    it('is accepted when nothing is tampered with (control)', async () => {
      const response = await callbackTampered(noTampering)

      expect(response.status).toBe(200)
    })

    const cases: [string, (callbackUrl: URL) => void, string][] = [
      [
        'a state that is not the one of this login',
        (url) => {
          url.searchParams.set('state', 'forged-state')
        },
        'OAUTH_INVALID_RESPONSE',
      ],
      [
        'no state',
        (url) => {
          url.searchParams.delete('state')
        },
        'OAUTH_INVALID_RESPONSE',
      ],
      [
        'no code',
        (url) => {
          url.searchParams.delete('code')
        },
        'OAUTH_INVALID_RESPONSE',
      ],
      [
        'a code the identity provider never issued',
        (url) => {
          url.searchParams.set('code', 'forged-code')
        },
        'OAUTH_RESPONSE_BODY_ERROR',
      ],
      [
        'another issuer than the one of the identity provider',
        (url) => {
          url.searchParams.set('iss', 'https://evil.example/realms/test')
        },
        'OAUTH_INVALID_RESPONSE',
      ],
      [
        'an error response from the identity provider',
        (url) => {
          url.searchParams.delete('code')
          url.searchParams.set('error', 'access_denied')
        },
        'OAUTH_AUTHORIZATION_RESPONSE_ERROR',
      ],
    ]

    it.each(cases)('is refused for %s', async (_name, tamper, code) => {
      const response = await callbackTampered(tamper)

      expectRefused(response, PROVIDER_REJECTED, `Authorization response rejected (`)
      expect(logged()).toContain(code)
    })
  })

  describe('because of the login cookie', () => {
    const checks = { state: 'state', nonce: 'nonce', codeVerifier: 'verifier' }

    it('is refused when the browser sends none', async () => {
      const response = await e2e.callbackWithCookie(await freshCallbackUrl())

      expectRefused(response, COOKIE_REJECTED, 'Login checks cookie is missing')
    })

    it.each([
      ['signed with another secret', () => forgedCookie('another-secret-with-at-least-32-characters', checks)],
      ['signed with the refresh secret', () => forgedCookie(REFRESH_SECRET, checks)],
      ['not a token at all', () => 'coffra_oidc_checks=garbage'],
    ])('is refused when it is %s', async (_name, cookie) => {
      const response = await e2e.callbackWithCookie(await freshCallbackUrl(), cookie())

      expectRefused(response, COOKIE_REJECTED, 'Login checks cookie rejected (')
    })

    it('is refused when it is signed correctly but does not carry the checks', async () => {
      const response = await e2e.callbackWithCookie(
        await freshCallbackUrl(),
        forgedCookie(CHECKS_SECRET, { state: 'state' }),
      )

      expectRefused(response, COOKIE_REJECTED, 'Login checks cookie has an unexpected shape')
    })

    it('is still good before the login time is up (control)', async () => {
      const browser = e2e.browser()
      const { authorizationUrl, checksCookie } = await e2e.startLogin(browser)
      const url = await e2e.authorize(authorizationUrl)
      e2e.travel(200)

      const response = await e2e.callbackWithCookie(url, checksCookie)

      expect(response.status).toBe(200)
    })

    it('is refused when the login took longer than 10 minutes', async () => {
      const browser = e2e.browser()
      const { authorizationUrl, checksCookie } = await e2e.startLogin(browser)
      const url = await e2e.authorize(authorizationUrl)
      e2e.travel(CHECKS_TTL_SECONDS + 1)

      const response = await e2e.callbackWithCookie(url, checksCookie)

      expectRefused(response, COOKIE_REJECTED, 'Login checks cookie rejected (TokenExpiredError)')
    })

    it('is refused when it belongs to another login: its state is not the one of this callback', async () => {
      const other = await e2e.startLogin(e2e.browser())
      const thisLogin = await e2e.startLogin(e2e.browser())
      const url = await e2e.authorize(thisLogin.authorizationUrl)

      const response = await e2e.callbackWithCookie(url, other.checksCookie)

      expectRefused(response, PROVIDER_REJECTED, 'Authorization response rejected (')
      expect(logged()).toContain('OAUTH_INVALID_RESPONSE')
    })
  })

  describe('because the code is used twice', () => {
    it('is refused the second time, even with the cookie put back', async () => {
      const { callbackUrl, checksCookie, response: first } = await e2e.attemptLogin()
      expect(first.status).toBe(200)

      const replay = await e2e.callbackWithCookie(callbackUrl, checksCookie)

      // the user of the first login, nothing more
      expectRefused(replay, PROVIDER_REJECTED, 'Authorization response rejected (', 1)
      expect(logged()).toContain('OAUTH_RESPONSE_BODY_ERROR')
    })
  })

  describe('because of the ID token', () => {
    it('is accepted with the same setup and a good token (control)', async () => {
      e2e.idp().idTokenClaims = {}

      const { response } = await e2e.attemptLogin()

      expect(response.status).toBe(200)
    })

    const cases: [string, () => void, string][] = [
      [
        'a nonce that is not the one of this login',
        () => (e2e.idp().idTokenClaims = { nonce: 'forged-nonce' }),
        'OAUTH_JWT_CLAIM_COMPARISON_FAILED',
      ],
      [
        'another audience',
        () => (e2e.idp().idTokenClaims = { aud: 'another-client' }),
        'OAUTH_JWT_CLAIM_COMPARISON_FAILED',
      ],
      [
        'another issuer',
        () => (e2e.idp().idTokenClaims = { iss: 'https://evil.example/realms/test' }),
        'OAUTH_JWT_CLAIM_COMPARISON_FAILED',
      ],
      [
        'an expiry in the past',
        () => (e2e.idp().idTokenClaims = { exp: now() - 3600 }),
        'OAUTH_JWT_TIMESTAMP_CHECK_FAILED',
      ],
      ['no subject', () => (e2e.idp().idTokenClaims = { sub: undefined }), 'OAUTH_INVALID_RESPONSE'],
    ]

    it.each(cases)('is refused with %s', async (_name, arrange, code) => {
      arrange()

      const { response } = await e2e.attemptLogin()

      expectRefused(response, PROVIDER_REJECTED, 'Authorization response rejected (')
      expect(logged()).toContain(code)
    })
  })

  describe('because of the token endpoint', () => {
    it('is refused when it turns the code down', async () => {
      e2e.idp().tokenEndpoint = 'invalid_grant'

      const { response } = await e2e.attemptLogin()

      expectRefused(response, PROVIDER_REJECTED, 'Authorization response rejected (')
    })
  })

  describe('because of the email', () => {
    it('is refused when neither the ID token nor userinfo has one', async () => {
      e2e.idp().user = { sub: e2e.idp().user.sub }

      const { response } = await e2e.attemptLogin()

      expectRefused(response, PROVIDER_REJECTED, 'Identity provider returned no email')
    })

    it('is refused when userinfo is about another subject than the ID token', async () => {
      e2e.idp().idTokenClaims = { email: undefined }
      e2e.idp().userinfo = { sub: 'someone-else' }

      const { response } = await e2e.attemptLogin()

      expectRefused(response, PROVIDER_REJECTED, 'Userinfo request rejected (')
    })

    it('is refused when userinfo turns the access token down', async () => {
      e2e.idp().idTokenClaims = { email: undefined }
      e2e.idp().userinfo = 'unauthorized'

      const { response } = await e2e.attemptLogin()

      expectRefused(response, PROVIDER_REJECTED, 'Userinfo request rejected (')
    })
  })
})
