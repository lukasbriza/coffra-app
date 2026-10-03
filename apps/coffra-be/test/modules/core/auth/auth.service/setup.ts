import 'reflect-metadata'

import { beforeEach, vi } from 'vitest'

import { type AuthChecks, type AuthProviderInterface, type AuthSession } from '../../../../../src/modules/core'
import { AuthChecksService } from '../../../../../src/modules/core/auth/auth-checks.service'
import { AuthTokensService } from '../../../../../src/modules/core/auth/auth-tokens.service'
import { AuthService } from '../../../../../src/modules/core/auth/auth.service'
import type { TokenPair } from '../../../../../src/modules/core/auth/types'
import { UsersService } from '../../../../../src/modules/core/users/users.service'
import { AuthSource, type User } from '../../../../../src/modules/prisma'

// Shared by the use case specs of `AuthService` (one file per method).

export const SUBJECT = 'dde84b4e-03ed-4990-a23b-e1be2e5eaf1a'
export const checks: AuthChecks = {
  state: 'expected-state',
  nonce: 'expected-nonce',
  codeVerifier: 'expected-verifier',
}
export const callback = new URLSearchParams({ code: 'one-time-code', state: checks.state })
export const session: AuthSession = { subject: SUBJECT, email: 'dev@coffra.local', accessToken: 'idp-access-token' }
export const tokenPair: TokenPair = { accessToken: 'access-jwt', refreshToken: 'refresh-jwt', expiresIn: 900 }

export const user: User = {
  id: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11',
  email: 'dev@coffra.local',
  authSource: AuthSource.oidc,
  externalSubject: SUBJECT,
  createdAt: new Date('2026-10-03T08:00:00Z'),
  updatedAt: new Date('2026-10-03T08:00:00Z'),
}

/**
 * The service under test with all four collaborators mocked. Call it inside a `describe`: it registers the
 * `beforeEach` that resets the mocks to their happy-path answers for that block.
 */
export const useAuthService = () => {
  const provider = {
    login: vi.fn<AuthProviderInterface['login']>(),
    validateSession: vi.fn<AuthProviderInterface['validateSession']>(),
    getUserInfo: vi.fn<AuthProviderInterface['getUserInfo']>(),
    logout: vi.fn<AuthProviderInterface['logout']>(),
  }
  const checksService = { sign: vi.fn<AuthChecksService['sign']>(), verify: vi.fn<AuthChecksService['verify']>() }
  const tokensService = {
    issue: vi.fn<AuthTokensService['issue']>(),
    verifyRefresh: vi.fn<AuthTokensService['verifyRefresh']>(),
  }
  const upsertByExternalSubject = vi.fn<UsersService['upsertByExternalSubject']>()
  const findById = vi.fn<UsersService['findById']>()
  const service = new AuthService(
    provider,
    checksService as unknown as AuthChecksService,
    tokensService as unknown as AuthTokensService,
    { upsertByExternalSubject, findById } as unknown as UsersService,
  )

  beforeEach(() => {
    provider.login.mockReset()
    provider.validateSession.mockReset().mockResolvedValue(session)
    provider.getUserInfo.mockReset()
    provider.logout.mockReset()
    checksService.sign.mockReset().mockResolvedValue('signed-checks')
    checksService.verify.mockReset().mockResolvedValue(checks)
    tokensService.issue.mockReset().mockResolvedValue(tokenPair)
    tokensService.verifyRefresh.mockReset().mockResolvedValue({ userId: user.id, expiresAt: 1_900_000_000 })
    upsertByExternalSubject.mockReset().mockResolvedValue(user)
    findById.mockReset().mockResolvedValue(user)
  })

  return { service, provider, checksService, tokensService, upsertByExternalSubject, findById }
}
