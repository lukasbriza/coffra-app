import { ServiceUnavailableException } from '@nestjs/common'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { END_SESSION_URL, setCookies, useAuthController } from './setup'

describe('POST /api/auth/logout', () => {
  const { provider, upsertByExternalSubject, findById, server } = useAuthController()

  it('hands back where the browser must go to end the session at the identity provider', async () => {
    const response = await request(server()).post('/api/auth/logout').expect(200)

    expect(response.body).toEqual({ endSessionUrl: END_SESSION_URL })
  })

  it('needs no token, so a client with an expired access token can still log out', async () => {
    await request(server()).post('/api/auth/logout').expect(200)
  })

  it('changes nothing on the server: no cookie, no user lookup', async () => {
    const response = await request(server()).post('/api/auth/logout').expect(200)

    expect(setCookies(response)).toEqual([])
    expect(findById).not.toHaveBeenCalled()
    expect(upsertByExternalSubject).not.toHaveBeenCalled()
  })

  it('passes on an identity provider without an end-session endpoint as null', async () => {
    provider.logout.mockResolvedValue({ endSessionUrl: null })

    const response = await request(server()).post('/api/auth/logout').expect(200)

    expect(response.body).toEqual({ endSessionUrl: null })
  })

  it('answers 503 when the identity provider is unavailable', async () => {
    provider.logout.mockRejectedValue(new ServiceUnavailableException('Identity provider is unavailable'))

    await request(server()).post('/api/auth/logout').expect(503)
  })

  it('is POST only', async () => {
    await request(server()).get('/api/auth/logout').expect(404)
  })
})
