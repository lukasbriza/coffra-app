import { describe, expect, it } from 'vitest'

import type { TokenPair } from '../../../src/modules/core/auth/types'

import { ACCESS_TTL_SECONDS, REFRESH_TTL_SECONDS, claimsOf, useAuthApp } from './setup'

describe('the session after a login', () => {
  const e2e = useAuthApp()

  describe('the access token', () => {
    it('opens the protected routes until it expires and not a second longer', async () => {
      const { tokens } = await e2e.login()

      e2e.travel(ACCESS_TTL_SECONDS - 1)
      await e2e.me(tokens.accessToken).expect(200)

      e2e.travel(2)
      const expired = await e2e.me(tokens.accessToken).expect(401)

      expect(expired.headers['www-authenticate']).toBe('Bearer')
      expect(expired.body).toMatchObject({ message: 'Invalid or expired access token' })
    })

    it('is not accepted in place of a refresh token', async () => {
      const { tokens } = await e2e.login()

      const response = await e2e.refresh({ refreshToken: tokens.accessToken }).expect(401)

      expect(response.body).toMatchObject({ message: 'Invalid or expired refresh token' })
    })
  })

  describe('the refresh token', () => {
    it('is not accepted in place of an access token', async () => {
      const { tokens } = await e2e.login()

      const response = await e2e.me(tokens.refreshToken).expect(401)

      expect(response.headers['www-authenticate']).toBe('Bearer')
    })

    it('renews the session after the access token has expired, without the access token', async () => {
      const { tokens } = await e2e.login()
      e2e.travel(ACCESS_TTL_SECONDS + 60)
      await e2e.me(tokens.accessToken).expect(401)

      // The expired access token is even sent along: refresh is public, so the guard must not read it.
      const renewed = await e2e
        .refresh({ refreshToken: tokens.refreshToken }, `Bearer ${tokens.accessToken}`)
        .expect(200)

      expect(renewed.headers['cache-control']).toBe('no-store')
      expect(renewed.body).toMatchObject({ expiresIn: ACCESS_TTL_SECONDS })
      await e2e.me((renewed.body as TokenPair).accessToken).expect(200)
    })

    it('ends the new session when the old one would have: a session cannot be extended by refreshing', async () => {
      const { tokens } = await e2e.login()
      e2e.travel(ACCESS_TTL_SECONDS + 60)

      const renewed = await e2e.refresh({ refreshToken: tokens.refreshToken }).expect(200)

      const next = renewed.body as { accessToken: string; refreshToken: string }
      expect(claimsOf(next.refreshToken).exp).toBe(claimsOf(tokens.refreshToken).exp)
      expect(claimsOf(next.accessToken).exp).toBeGreaterThan(claimsOf(tokens.accessToken).exp as number)
    })

    it('is good until its lifetime from the login is over, however often it was swapped (control)', async () => {
      const { tokens } = await e2e.login()
      e2e.travel(REFRESH_TTL_SECONDS - 60)

      await e2e.refresh({ refreshToken: tokens.refreshToken }).expect(200)
    })

    it('is refused once its lifetime from the login is over', async () => {
      const { tokens } = await e2e.login()
      e2e.travel(REFRESH_TTL_SECONDS + 1)

      const response = await e2e.refresh({ refreshToken: tokens.refreshToken }).expect(401)

      expect(response.headers['www-authenticate']).toBeUndefined() // answered by the route, not turned away by the guard
      expect(response.body).toMatchObject({ message: 'Invalid or expired refresh token' })
    })
  })

  describe('a user who no longer exists', () => {
    it('is turned away by /me although the access token is still valid', async () => {
      const { tokens } = await e2e.login()
      e2e.prisma().deleteUsers()

      const response = await e2e.me(tokens.accessToken).expect(401)

      expect(response.body).toMatchObject({ message: 'Invalid or expired access token' })
    })

    it('cannot refresh the session, and nothing is issued', async () => {
      const { tokens } = await e2e.login()
      e2e.prisma().deleteUsers()

      const response = await e2e.refresh({ refreshToken: tokens.refreshToken }).expect(401)

      expect(response.body).not.toHaveProperty('accessToken')
      expect(response.body).toMatchObject({ message: 'Invalid or expired refresh token' })
    })

    it('can log in again and is a new user', async () => {
      const first = await e2e.login()
      e2e.prisma().deleteUsers()

      const second = await e2e.login()

      expect(claimsOf(second.tokens.accessToken).sub).not.toBe(claimsOf(first.tokens.accessToken).sub)
      await e2e.me(first.tokens.accessToken).expect(401)
      await e2e.me(second.tokens.accessToken).expect(200)
    })
  })
})
