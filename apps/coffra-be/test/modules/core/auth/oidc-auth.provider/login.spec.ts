import { createHash } from 'node:crypto'

import { describe, expect, it, vi } from 'vitest'

import { build, ISSUER, REDIRECT_URI, useOidcProvider } from './setup'

// See setup.ts: the mock is hoisted per file, so every spec of this folder repeats it.
vi.mock('openid-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('openid-client')>()),
  discovery: vi.fn(),
  authorizationCodeGrant: vi.fn(),
  fetchUserInfo: vi.fn(),
}))

describe('OidcAuthProvider.login', () => {
  useOidcProvider()

  it('builds an authorization URL with PKCE S256, state and nonce', async () => {
    const { authorizationUrl, checks: issued } = await build().login()
    const url = new URL(authorizationUrl)

    expect(`${url.origin}${url.pathname}`).toBe(`${ISSUER}/auth`)
    expect(url.searchParams.get('client_id')).toBe('coffra-be')
    expect(url.searchParams.get('redirect_uri')).toBe(REDIRECT_URI)
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')?.split(' ')).toContain('openid')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('code_challenge')).toBe(
      createHash('sha256').update(issued.codeVerifier).digest('base64url'),
    )
    expect(url.searchParams.get('state')).toBe(issued.state)
    expect(url.searchParams.get('nonce')).toBe(issued.nonce)
  })

  it('never sends the code verifier to the browser', async () => {
    const { authorizationUrl, checks: issued } = await build().login()

    expect(authorizationUrl).not.toContain(issued.codeVerifier)
  })

  it('issues fresh checks on every call', async () => {
    const provider = build()
    const { checks: first } = await provider.login()
    const { checks: second } = await provider.login()

    expect(second.state).not.toBe(first.state)
    expect(second.nonce).not.toBe(first.nonce)
    expect(second.codeVerifier).not.toBe(first.codeVerifier)
  })
})
