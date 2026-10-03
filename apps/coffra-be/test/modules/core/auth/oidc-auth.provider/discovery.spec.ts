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

describe('OidcAuthProvider discovery', () => {
  useOidcProvider()

  it('runs once and is reused', async () => {
    const provider = build()

    await provider.login()
    await provider.login()

    expect(client.discovery).toHaveBeenCalledTimes(1)
  })

  it('does not run before the first use', () => {
    build()

    expect(client.discovery).not.toHaveBeenCalled()
  })

  it('reports an unreachable IdP as 503 and retries on the next call', async () => {
    vi.mocked(client.discovery).mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:8080'))
    const provider = build()

    await expect(provider.login()).rejects.toBeInstanceOf(ServiceUnavailableException)
    await expect(provider.login()).resolves.toHaveProperty('authorizationUrl')
    expect(client.discovery).toHaveBeenCalledTimes(2)
  })

  it('passes the configured issuer and client credentials', async () => {
    await build().login()

    expect(client.discovery).toHaveBeenCalledWith(new URL(ISSUER), 'coffra-be', 'coffra-dev-secret', undefined, {
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- the dev http issuer needs it, see ADR 0008
      execute: [client.allowInsecureRequests],
    })
  })

  it.each([
    { name: 'development', nodeEnv: 'development' },
    { name: 'production', nodeEnv: 'production' },
  ])('does not allow insecure requests for an https issuer in $name', async ({ nodeEnv }) => {
    await build({ OIDC_ISSUER_URL: 'https://auth.example.com/realms/coffra', NODE_ENV: nodeEnv }).login()

    expect(vi.mocked(client.discovery).mock.calls[0]?.[4]).toBeUndefined()
  })

  it('does not allow insecure requests for an http issuer in production, so the library refuses it', async () => {
    await expect(build({ NODE_ENV: 'production' }).login()).rejects.toMatchObject({
      code: 'OAUTH_HTTP_REQUEST_FORBIDDEN',
    })

    expect(vi.mocked(client.discovery).mock.calls[0]?.[4]).toBeUndefined()
  })
})
