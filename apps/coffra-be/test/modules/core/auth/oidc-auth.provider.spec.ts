import 'reflect-metadata'

import { createHash } from 'node:crypto'

import { Global, Logger, Module, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import * as client from 'openid-client'
import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'

import type { Env } from '../../../../src/modules/config'
import { AUTH_PROVIDER, type AuthChecks, type AuthProviderInterface, CoreModule } from '../../../../src/modules/core'
import { OidcAuthProvider } from '../../../../src/modules/core/auth/oidc-auth.provider'

// Only the network calls are mocked: PKCE helpers and `buildAuthorizationUrl` stay real,
// so the tests check the URL the browser would actually be sent to.
vi.mock('openid-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('openid-client')>()),
  discovery: vi.fn(),
  authorizationCodeGrant: vi.fn(),
  fetchUserInfo: vi.fn(),
}))

const ISSUER = 'http://localhost:8080/realms/coffra'
const REDIRECT_URI = 'http://localhost:3000/api/auth/callback'
const SUBJECT = 'dde84b4e-03ed-4990-a23b-e1be2e5eaf1a'

const baseConfig: Record<string, unknown> = {
  NODE_ENV: 'development',
  OIDC_ISSUER_URL: ISSUER,
  OIDC_CLIENT_ID: 'coffra-be',
  OIDC_CLIENT_SECRET: 'coffra-dev-secret',
  OIDC_REDIRECT_URI: REDIRECT_URI,
}

const configService = (overrides: Record<string, unknown> = {}) => {
  const values = { ...baseConfig, ...overrides }
  return { get: (key: string) => values[key] } as unknown as ConfigService<Env, true>
}

const build = (overrides: Record<string, unknown> = {}) => new OidcAuthProvider(configService(overrides))

const checks: AuthChecks = { state: 'expected-state', nonce: 'expected-nonce', codeVerifier: 'expected-verifier' }
const callback = new URLSearchParams({ code: 'one-time-code', state: checks.state })

const silence = (): void => {
  // keeps expected warnings out of the test output
}

const tokenResponse = (claims?: Record<string, unknown>) =>
  ({ access_token: 'idp-access-token', claims: () => claims }) as unknown as Awaited<
    ReturnType<typeof client.authorizationCodeGrant>
  >

// `ClientError` takes its `code` from the constructor options at runtime, but its typings omit it.
const clientError = (message: string, code: string) => Object.assign(new client.ClientError(message), { code })

const userInfoResponse = (info: Record<string, unknown>) =>
  info as unknown as Awaited<ReturnType<typeof client.fetchUserInfo>>

describe('OidcAuthProvider', () => {
  let configuration: client.Configuration
  let warn: MockInstance<Logger['warn']>

  beforeEach(() => {
    vi.resetAllMocks()
    // Mirrors the real `discovery`: a Configuration for the issuer, with `execute` hooks applied
    // (so a plain http issuer only works when the provider asked for `allowInsecureRequests`).
    vi.mocked(client.discovery).mockImplementation((server, clientId, metadata, _auth, options) => {
      const issuer = server.href.replace(/\/$/, '')
      configuration = new client.Configuration(
        { issuer, authorization_endpoint: `${issuer}/auth`, token_endpoint: `${issuer}/token` },
        clientId,
        metadata,
      )
      for (const apply of options?.execute ?? []) {
        apply(configuration)
      }
      return Promise.resolve(configuration)
    })
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(silence)
    vi.spyOn(Logger.prototype, 'error').mockImplementation(silence)
  })

  describe('login', () => {
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

  describe('validateSession', () => {
    it('exchanges the code with the stored checks and maps the claims', async () => {
      vi.mocked(client.authorizationCodeGrant).mockResolvedValue(
        tokenResponse({ sub: SUBJECT, email: 'dev@coffra.local' }),
      )

      const session = await build().validateSession(callback, checks)

      expect(session).toEqual({ subject: SUBJECT, email: 'dev@coffra.local', accessToken: 'idp-access-token' })
      expect(client.authorizationCodeGrant).toHaveBeenCalledWith(configuration, expect.any(URL), {
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
      const logged = warn.mock.calls.map(([message]) => String(message)).join(' ')
      expect(logged).toContain('OAUTH_INVALID_RESPONSE')
      expect(logged).not.toContain('one-time-code')
    })

    it('rejects a response without an ID token', async () => {
      vi.mocked(client.authorizationCodeGrant).mockResolvedValue(tokenResponse())

      await expect(build().validateSession(callback, checks)).rejects.toBeInstanceOf(UnauthorizedException)
    })
  })

  describe('getUserInfo', () => {
    const session = { subject: SUBJECT, accessToken: 'idp-access-token' }

    it('maps the userinfo response and checks the subject', async () => {
      vi.mocked(client.fetchUserInfo).mockResolvedValue(
        userInfoResponse({ sub: SUBJECT, email: 'dev@coffra.local', email_verified: true, name: 'Dev User' }),
      )

      const info = await build().getUserInfo(session)

      expect(info).toEqual({ subject: SUBJECT, email: 'dev@coffra.local', emailVerified: true, name: 'Dev User' })
      expect(client.fetchUserInfo).toHaveBeenCalledWith(configuration, 'idp-access-token', SUBJECT)
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

  describe('discovery', () => {
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
})

describe('CoreModule', () => {
  it('provides an AuthProviderInterface under AUTH_PROVIDER, resolved through @Inject', async () => {
    @Global()
    @Module({ providers: [{ provide: ConfigService, useValue: configService() }], exports: [ConfigService] })
    class ConfigStubModule {}

    const moduleRef = await Test.createTestingModule({ imports: [ConfigStubModule, CoreModule] }).compile()
    const provider = moduleRef.get<AuthProviderInterface>(AUTH_PROVIDER)

    expect(provider).toBeInstanceOf(OidcAuthProvider)
  })
})
