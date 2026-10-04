import 'reflect-metadata'

import { Logger } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import * as client from 'openid-client'
import { beforeEach, type MockInstance, vi } from 'vitest'

import type { Env } from '../../../../../src/modules/config'
import type { AuthChecks } from '../../../../../src/modules/core'
import { OidcAuthProvider } from '../../../../../src/modules/core/auth/oidc-auth.provider'

// Shared by the use case specs of `OidcAuthProvider` (login, validateSession, getUserInfo, logout, discovery).
//
// Every one of those specs must start with the same `vi.mock('openid-client', ...)`: it is hoisted per file, so
// it cannot live here. Only the network calls are mocked, PKCE helpers and `buildAuthorizationUrl` stay real,
// so the tests check the URL the browser would actually be sent to.

export const ISSUER = 'http://localhost:8080/realms/coffra'
export const REDIRECT_URI = 'http://localhost:3000/api/auth/callback'
export const SUBJECT = 'dde84b4e-03ed-4990-a23b-e1be2e5eaf1a'

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

export const build = (overrides: Record<string, unknown> = {}) => new OidcAuthProvider(configService(overrides))

export const checks: AuthChecks = {
  state: 'expected-state',
  nonce: 'expected-nonce',
  codeVerifier: 'expected-verifier',
}
export const callback = new URLSearchParams({ code: 'one-time-code', state: checks.state })

const silence = (): void => {
  // keeps expected warnings out of the test output
}

export const tokenResponse = (claims?: Record<string, unknown>) =>
  ({ access_token: 'idp-access-token', claims: () => claims }) as unknown as Awaited<
    ReturnType<typeof client.authorizationCodeGrant>
  >

// `ClientError` takes its `code` from the constructor options at runtime, but its typings omit it.
export const clientError = (message: string, code: string) => Object.assign(new client.ClientError(message), { code })

export const userInfoResponse = (info: Record<string, unknown>) =>
  info as unknown as Awaited<ReturnType<typeof client.fetchUserInfo>>

/**
 * Call it inside a `describe`: registers the `beforeEach` that resets every mock, makes the mocked `discovery`
 * behave like the real one and silences the expected log output.
 */
export const useOidcProvider = () => {
  let configuration: client.Configuration
  let warn: MockInstance<Logger['warn']>
  /** `end_session_endpoint` is optional in discovery, so a test can switch it off. */
  let advertisesEndSession = true

  beforeEach(() => {
    vi.resetAllMocks()
    advertisesEndSession = true
    // Mirrors the real `discovery`: a Configuration for the issuer, with `execute` hooks applied
    // (so a plain http issuer only works when the provider asked for `allowInsecureRequests`).
    vi.mocked(client.discovery).mockImplementation((server, clientId, metadata, _auth, options) => {
      const issuer = server.href.replace(/\/$/, '')
      configuration = new client.Configuration(
        {
          issuer,
          authorization_endpoint: `${issuer}/auth`,
          token_endpoint: `${issuer}/token`,
          ...(advertisesEndSession ? { end_session_endpoint: `${issuer}/logout` } : {}),
        },
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

  return {
    /** The `Configuration` the last discovery produced. */
    configuration: (): client.Configuration => configuration,
    /** The spy on `Logger.warn`, fresh for each test. */
    warn: (): MockInstance<Logger['warn']> => warn,
    /** Makes the next discovery answer without an `end_session_endpoint`. */
    withoutEndSession: (): void => {
      advertisesEndSession = false
    },
  }
}
