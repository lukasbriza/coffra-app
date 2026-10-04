import { JwtService } from '@nestjs/jwt'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { CHECKS_SECRET, REFRESH_SECRET, claimsOf, useAuthApp } from './setup'

// The check ADR 0011 asks of every e2e bootstrap: the app as `main.ts` boots it turns a request without a valid
// access token away. If the global guard line were missing from `setup.ts`, every spec here would fail.

describe('the protected routes of the whole app', () => {
  const e2e = useAuthApp()

  describe('are turned away', () => {
    it('without an Authorization header', async () => {
      const response = await e2e.me().expect(401)

      expect(response.headers['www-authenticate']).toBe('Bearer')
      expect(response.body).toEqual({
        message: 'Invalid or expired access token',
        error: 'Unauthorized',
        statusCode: 401,
      })
    })

    it.each([
      ['a token that is not one', 'Bearer garbage'],
      ['another scheme', 'Basic ZGV2OmRldg=='],
      ['no token after the scheme', 'Bearer'],
    ])('with %s', async (_name, authorization) => {
      const response = await request(e2e.server()).get('/api/users/me').set('Authorization', authorization).expect(401)

      expect(response.headers['www-authenticate']).toBe('Bearer')
    })

    describe('with a token of the app that is not a good access token', () => {
      const jwt = new JwtService()

      it('signed with the refresh secret', async () => {
        const token = jwt.sign({ sub: 'someone' }, { secret: REFRESH_SECRET, algorithm: 'HS256', expiresIn: 900 })

        await e2e.me(token).expect(401)
      })

      it('signed with the secret of the login cookie', async () => {
        const token = jwt.sign({ sub: 'someone' }, { secret: CHECKS_SECRET, algorithm: 'HS256', expiresIn: 900 })

        await e2e.me(token).expect(401)
      })

      it('with its subject changed after signing', async () => {
        const { tokens } = await e2e.login()
        const [header, , signature] = tokens.accessToken.split('.')
        const forgedClaims = Buffer.from(
          JSON.stringify({ ...claimsOf(tokens.accessToken), sub: 'someone-else' }),
        ).toString('base64url')

        await e2e.me(`${header}.${forgedClaims}.${signature}`).expect(401)
      })

      it('with no signature at all (alg none)', async () => {
        const { tokens } = await e2e.login()
        const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
        const claims = Buffer.from(JSON.stringify(claimsOf(tokens.accessToken))).toString('base64url')

        await e2e.me(`${header}.${claims}.`).expect(401)
      })
    })
  })

  it('are reached with the access token of a login (control)', async () => {
    const { tokens } = await e2e.login()

    await e2e.me(tokens.accessToken).expect(200)
  })

  describe('leave exactly the public routes open', () => {
    it('answers the health check without a token', async () => {
      const response = await request(e2e.server()).get('/api/health').expect(200)

      expect(response.body).toMatchObject({ status: 'ok' })
    })

    it('starts a login without a token', async () => {
      await request(e2e.server()).get('/api/auth/login').expect(302)
    })

    it('hands out the end session URL without a token', async () => {
      await request(e2e.server()).post('/api/auth/logout').expect(200)
    })

    it('does not let a token-less refresh or callback through the guard: the route itself answers', async () => {
      const refresh = await e2e.refresh({}).expect(400)
      const callback = await request(e2e.server()).get('/api/auth/callback').expect(401)

      // Only the guard sets `WWW-Authenticate`: its absence says the guard let the request through.
      expect(refresh.headers['www-authenticate']).toBeUndefined()
      expect(callback.headers['www-authenticate']).toBeUndefined()
    })
  })

  it('answers 404 for a route that does not exist, with or without a token', async () => {
    await request(e2e.server()).get('/api/nothing-here').expect(404)
    await request(e2e.server()).get('/nothing-here').set('Authorization', 'Bearer garbage').expect(404)
  })
})
