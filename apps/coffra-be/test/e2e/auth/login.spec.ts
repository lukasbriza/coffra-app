import { describe, expect, it } from 'vitest'

import { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } from '../support/fake-idp'

import { claimsOf, useAuthApp } from './setup'

describe('login', () => {
  const e2e = useAuthApp()

  describe('the whole flow', () => {
    it('logs in through the identity provider and opens the protected routes', async () => {
      const { response, tokens } = await e2e.login()

      expect(response.headers['cache-control']).toBe('no-store')
      expect(Object.keys(tokens).toSorted()).toEqual(['accessToken', 'expiresIn', 'refreshToken'])
      expect(tokens.expiresIn).toBe(900)

      const me = await e2e.me(tokens.accessToken).expect(200)

      expect(me.body).toEqual({ id: claimsOf(tokens.accessToken).sub, email: 'dev@coffra.local' })
    })

    it('keeps the identity provider subject out of every response', async () => {
      const { tokens } = await e2e.login()
      const me = await e2e.me(tokens.accessToken).expect(200)

      expect(JSON.stringify([tokens, me.body])).not.toContain(e2e.idp().user.sub)
    })
  })

  describe('what the identity provider receives', () => {
    it('is asked for the code flow with PKCE S256, state and nonce, for exactly the registered redirect URI', async () => {
      await e2e.login()

      const [authorization] = e2e.idp().authorizationRequests
      expect(authorization.get('response_type')).toBe('code')
      expect(authorization.get('client_id')).toBe(CLIENT_ID)
      expect(authorization.get('redirect_uri')).toBe(REDIRECT_URI)
      expect((authorization.get('scope') ?? '').split(' ')).toContain('openid')
      expect(authorization.get('code_challenge_method')).toBe('S256')
      expect(authorization.get('state')).toBeTruthy()
      expect(authorization.get('nonce')).toBeTruthy()
    })

    it('keeps the PKCE verifier out of the browser and sends it with the code exchange only', async () => {
      await e2e.login()

      const [authorization] = e2e.idp().authorizationRequests
      const [exchange] = e2e.idp().tokenRequests
      expect(authorization.has('code_verifier')).toBe(false)
      expect(exchange.form.get('code_verifier')).toBeTruthy()
      expect(exchange.form.get('code_verifier')).not.toBe(authorization.get('code_challenge'))
    })

    it('authenticates to the token endpoint with the configured client credentials', async () => {
      await e2e.login()

      expect(e2e.idp().tokenRequests).toHaveLength(1)
      expect(e2e.idp().tokenRequests[0].client).toMatchObject({ id: CLIENT_ID, secret: CLIENT_SECRET })
    })

    it('uses a fresh state, nonce and PKCE verifier for every login', async () => {
      await e2e.login()
      await e2e.login()

      const [first, second] = e2e.idp().authorizationRequests
      expect(second.get('state')).not.toBe(first.get('state'))
      expect(second.get('nonce')).not.toBe(first.get('nonce'))
      expect(second.get('code_challenge')).not.toBe(first.get('code_challenge'))
    })
  })

  describe('the single-use login cookie', () => {
    it('is cleared by the callback', async () => {
      const { response } = await e2e.login()

      const cleared = (response.headers['set-cookie'] as unknown as string[]).find((cookie) =>
        cookie.startsWith('coffra_oidc_checks='),
      )
      expect(cleared).toMatch(/^coffra_oidc_checks=;/)
      expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/)
    })

    it('is gone for a second callback with the same response, which is refused', async () => {
      const { browser, callbackUrl } = await e2e.login()

      const replay = await e2e.callback(browser, callbackUrl)

      expect(replay.status).toBe(401)
    })
  })

  describe('the user', () => {
    it('is created on the first login and found again on the second', async () => {
      const first = await e2e.login()
      const second = await e2e.login()

      expect(claimsOf(second.tokens.accessToken).sub).toBe(claimsOf(first.tokens.accessToken).sub)
      expect(e2e.prisma().users()).toHaveLength(1)
    })

    it('follows an email the identity provider changed since the last login', async () => {
      await e2e.login()
      e2e.idp().user = { ...e2e.idp().user, email: 'new@coffra.local' }

      const { tokens } = await e2e.login()

      const me = await e2e.me(tokens.accessToken).expect(200)
      expect(me.body).toMatchObject({ email: 'new@coffra.local' })
      expect(e2e.prisma().users()).toHaveLength(1)
    })

    it('is not linked to another account by email: a new subject is a new user', async () => {
      await e2e.login()
      e2e.idp().user = { ...e2e.idp().user, sub: 'e2e-subject-2' }

      await e2e.login()

      expect(e2e.prisma().users()).toHaveLength(2)
    })

    it('takes the email from userinfo when the ID token has none', async () => {
      e2e.idp().idTokenClaims = { email: undefined, email_verified: undefined }

      const { tokens } = await e2e.login()

      const me = await e2e.me(tokens.accessToken).expect(200)
      expect(me.body).toMatchObject({ email: 'dev@coffra.local' })
    })
  })
})
