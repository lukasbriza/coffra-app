import { UnauthorizedException } from '@nestjs/common'
import * as client from 'openid-client'
import { describe, expect, it, vi } from 'vitest'

import { build, clientError, SUBJECT, useOidcProvider, userInfoResponse } from './setup'

// See setup.ts: the mock is hoisted per file, so every spec of this folder repeats it.
vi.mock('openid-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('openid-client')>()),
  discovery: vi.fn(),
  authorizationCodeGrant: vi.fn(),
  fetchUserInfo: vi.fn(),
}))

describe('OidcAuthProvider.getUserInfo', () => {
  const { configuration } = useOidcProvider()
  const session = { subject: SUBJECT, accessToken: 'idp-access-token' }

  it('maps the userinfo response and checks the subject', async () => {
    vi.mocked(client.fetchUserInfo).mockResolvedValue(
      userInfoResponse({ sub: SUBJECT, email: 'dev@coffra.local', email_verified: true, name: 'Dev User' }),
    )

    const info = await build().getUserInfo(session)

    expect(info).toEqual({ subject: SUBJECT, email: 'dev@coffra.local', emailVerified: true, name: 'Dev User' })
    expect(client.fetchUserInfo).toHaveBeenCalledWith(configuration(), 'idp-access-token', SUBJECT)
  })

  it('falls back to the email from the ID token', async () => {
    vi.mocked(client.fetchUserInfo).mockResolvedValue(userInfoResponse({ sub: SUBJECT }))

    const info = await build().getUserInfo({ ...session, email: 'from-id-token@coffra.local' })

    expect(info.email).toBe('from-id-token@coffra.local')
  })

  it('rejects when neither userinfo nor the ID token has an email', async () => {
    vi.mocked(client.fetchUserInfo).mockResolvedValue(userInfoResponse({ sub: SUBJECT, email: 42 }))

    await expect(build().getUserInfo(session)).rejects.toBeInstanceOf(UnauthorizedException)
  })

  it('maps a failed userinfo request (e.g. subject mismatch) to 401', async () => {
    vi.mocked(client.fetchUserInfo).mockRejectedValue(
      clientError('unexpected sub', 'OAUTH_JSON_ATTRIBUTE_COMPARISON_FAILED'),
    )

    await expect(build().getUserInfo(session)).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
