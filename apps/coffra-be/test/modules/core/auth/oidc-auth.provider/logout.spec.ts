import { ServiceUnavailableException } from '@nestjs/common'
import * as client from 'openid-client'
import { describe, expect, it, vi } from 'vitest'

import { build, ISSUER, useOidcProvider } from './setup'

// See setup.ts: the mock is hoisted per file, so every spec of this folder repeats it.
vi.mock('openid-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('openid-client')>()),
  discovery: vi.fn(),
  authorizationCodeGrant: vi.fn(),
  fetchUserInfo: vi.fn(),
}))

describe('OidcAuthProvider.logout', () => {
  const { withoutEndSession } = useOidcProvider()

  it('builds the end-session URL with the client id and nothing else', async () => {
    const { endSessionUrl } = await build().logout()
    const url = new URL(endSessionUrl ?? '')

    expect(`${url.origin}${url.pathname}`).toBe(`${ISSUER}/logout`)
    expect([...url.searchParams.keys()]).toEqual(['client_id'])
    expect(url.searchParams.get('client_id')).toBe('coffra-be')
  })

  it('sends no token and no redirect target (there is no ID token to hint with and no frontend to return to)', async () => {
    const { endSessionUrl } = await build().logout()

    expect(endSessionUrl).not.toContain('id_token_hint')
    expect(endSessionUrl).not.toContain('post_logout_redirect_uri')
  })

  it('answers null when the identity provider has no end-session endpoint', async () => {
    withoutEndSession()

    await expect(build().logout()).resolves.toEqual({ endSessionUrl: null })
  })

  it('reports an unreachable IdP as 503', async () => {
    vi.mocked(client.discovery).mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:8080'))

    await expect(build().logout()).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it('does not call the identity provider beyond discovery', async () => {
    await build().logout()

    expect(client.authorizationCodeGrant).not.toHaveBeenCalled()
    expect(client.fetchUserInfo).not.toHaveBeenCalled()
  })
})
