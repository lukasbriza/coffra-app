import { describe, expect, it } from 'vitest'

import { CLIENT_ID } from '../support/fake-idp'

import { useAuthApp } from './setup'

describe('logout', () => {
  const e2e = useAuthApp()

  it('points the browser at the end session endpoint of the identity provider', async () => {
    const response = await e2e.browser().post('/api/auth/logout').expect(200)

    expect(response.body).toEqual({ endSessionUrl: `${e2e.idp().issuer}/logout?client_id=${CLIENT_ID}` })
  })

  it('needs no token, so a client whose access token has expired can still log out', async () => {
    const { tokens } = await e2e.login()
    e2e.travel(3600)

    const response = await e2e.browser().post('/api/auth/logout').set('Authorization', `Bearer ${tokens.accessToken}`)

    expect(response.status).toBe(200)
  })

  it('changes nothing on the server: the tokens of the user keep working until they expire', async () => {
    const { tokens } = await e2e.login()

    await e2e.browser().post('/api/auth/logout').expect(200)

    await e2e.me(tokens.accessToken).expect(200)
    await e2e.refresh({ refreshToken: tokens.refreshToken }).expect(200)
  })

  it('answers null when the identity provider has no end session endpoint', async () => {
    e2e.idp().advertiseEndSession = false

    const response = await e2e.browser().post('/api/auth/logout').expect(200)

    expect(response.body).toEqual({ endSessionUrl: null })
  })
})
