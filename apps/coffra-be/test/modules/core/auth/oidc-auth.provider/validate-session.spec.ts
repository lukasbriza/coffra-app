import { UnauthorizedException } from '@nestjs/common'
import * as client from 'openid-client'
import { describe, expect, it, vi } from 'vitest'

import { build, callback, checks, clientError, REDIRECT_URI, SUBJECT, tokenResponse, useOidcProvider } from './setup'

// See setup.ts: the mock is hoisted per file, so every spec of this folder repeats it.
vi.mock('openid-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('openid-client')>()),
  discovery: vi.fn(),
  authorizationCodeGrant: vi.fn(),
  fetchUserInfo: vi.fn(),
}))

describe('OidcAuthProvider.validateSession', () => {
  const { configuration, warn } = useOidcProvider()

  it('exchanges the code with the stored checks and maps the claims', async () => {
    vi.mocked(client.authorizationCodeGrant).mockResolvedValue(
      tokenResponse({ sub: SUBJECT, email: 'dev@coffra.local' }),
    )

    const session = await build().validateSession(callback, checks)

    expect(session).toEqual({ subject: SUBJECT, email: 'dev@coffra.local', accessToken: 'idp-access-token' })
    expect(client.authorizationCodeGrant).toHaveBeenCalledWith(configuration(), expect.any(URL), {
      pkceCodeVerifier: checks.codeVerifier,
      expectedState: checks.state,
      expectedNonce: checks.nonce,
      idTokenExpected: true,
    })
  })

  it('derives the callback URL from the configured redirect URI, not from the request', async () => {
    vi.mocked(client.authorizationCodeGrant).mockResolvedValue(tokenResponse({ sub: SUBJECT }))

    await build().validateSession(callback, checks)

    const currentUrl = vi.mocked(client.authorizationCodeGrant).mock.calls[0]?.[1] as URL
    expect(`${currentUrl.origin}${currentUrl.pathname}`).toBe(REDIRECT_URI)
    expect(currentUrl.searchParams.get('code')).toBe('one-time-code')
    expect(currentUrl.searchParams.get('state')).toBe(checks.state)
  })

  it('leaves email undefined when the ID token has none', async () => {
    vi.mocked(client.authorizationCodeGrant).mockResolvedValue(tokenResponse({ sub: SUBJECT }))

    const session = await build().validateSession(callback, checks)

    expect(session.email).toBeUndefined()
  })

  it('maps a failed token exchange to a generic 401 without library text', async () => {
    vi.mocked(client.authorizationCodeGrant).mockRejectedValue(
      clientError('one-time-code leaked in message', 'OAUTH_INVALID_RESPONSE'),
    )

    const result = build().validateSession(callback, checks)

    await expect(result).rejects.toBeInstanceOf(UnauthorizedException)
    await expect(result).rejects.toThrow('Authentication failed')
    // The log carries the error code, never the library message (which can echo IdP data).
    const logged = warn()
      .mock.calls.map(([message]) => String(message))
      .join(' ')
    expect(logged).toContain('OAUTH_INVALID_RESPONSE')
    expect(logged).not.toContain('one-time-code')
  })

  it('rejects a response without an ID token', async () => {
    vi.mocked(client.authorizationCodeGrant).mockResolvedValue(tokenResponse())

    await expect(build().validateSession(callback, checks)).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
