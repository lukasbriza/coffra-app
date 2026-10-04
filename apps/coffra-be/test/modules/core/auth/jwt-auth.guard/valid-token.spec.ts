import { describe, expect, it, vi } from 'vitest'

import { AuthTokensService } from '../../../../../src/modules/core/auth/auth-tokens.service'

import { handler, useJwtAuthGuard, USER_ID } from './setup'

describe('JwtAuthGuard with a valid access token', () => {
  const { accessToken, application, get } = useJwtAuthGuard()

  it('lets the request through and hands the user id to @CurrentUser()', async () => {
    const response = await get('/api/probe', `Bearer ${await accessToken()}`).expect(200)

    expect(response.body).toEqual({ userId: USER_ID })
    expect(handler).toHaveBeenCalledExactlyOnceWith(USER_ID)
  })

  it('takes the user id from the token, not from anything else in the request', async () => {
    const other = '9c1d6f70-5a3e-4c63-8b52-0f1b6a7e2d44'

    const response = await get('/api/probe?userId=attacker', `Bearer ${await accessToken(other)}`).expect(200)

    expect(response.body).toEqual({ userId: other })
  })

  it('accepts the scheme in any letter case', async () => {
    await get('/api/probe', `bearer ${await accessToken()}`).expect(200)
  })

  it('verifies the bare token as an access token, never as a refresh token', async () => {
    const tokens = application().get(AuthTokensService)
    const verifyAccess = vi.spyOn(tokens, 'verifyAccess')
    const verifyRefresh = vi.spyOn(tokens, 'verifyRefresh')
    const token = await accessToken()

    await get('/api/probe', `Bearer ${token}`).expect(200)

    expect(verifyAccess).toHaveBeenCalledExactlyOnceWith(token)
    expect(verifyRefresh).not.toHaveBeenCalled()
  })

  it('does not look the user up: it only checks the token', async () => {
    // A token for a user that does not exist anywhere passes the guard (ADR 0006, 0010): there is no database here.
    await get('/api/probe', `Bearer ${await accessToken('00000000-0000-4000-8000-000000000000')}`).expect(200)
  })
})
