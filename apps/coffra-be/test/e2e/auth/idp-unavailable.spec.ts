import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { useAuthApp } from './setup'

describe('an identity provider that is down', () => {
  const e2e = useAuthApp()

  it('makes a login a 503 and sets no cookie', async () => {
    e2e.idp().down = true

    const response = await e2e.browser().get('/api/auth/login').expect(503)

    expect(response.body).toMatchObject({ message: 'Identity provider is unavailable' })
    expect(response.headers['set-cookie']).toBeUndefined()
    expect(e2e.error()).toHaveBeenCalledWith(expect.stringContaining('OIDC discovery failed'))
  })

  it('makes a logout a 503', async () => {
    e2e.idp().down = true

    const response = await e2e.browser().post('/api/auth/logout').expect(503)

    expect(response.body).toMatchObject({ message: 'Identity provider is unavailable' })
  })

  it('does not take the app down: the health check and the sessions already issued carry on', async () => {
    const { tokens } = await e2e.login()
    e2e.idp().down = true

    await request(e2e.server()).get('/api/health').expect(200)
    await e2e.me(tokens.accessToken).expect(200)
    await e2e.refresh({ refreshToken: tokens.refreshToken }).expect(200)
  })

  it('recovers by itself: a failed discovery is not remembered', async () => {
    e2e.idp().down = true
    await e2e.browser().get('/api/auth/login').expect(503)

    e2e.idp().down = false

    const { tokens } = await e2e.login()
    await e2e.me(tokens.accessToken).expect(200)
  })
})
