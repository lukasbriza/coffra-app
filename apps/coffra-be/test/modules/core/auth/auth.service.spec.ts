import 'reflect-metadata'

import { UnauthorizedException } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  AUTH_PROVIDER,
  type AuthChecks,
  type AuthProviderInterface,
  type AuthSession,
} from '../../../../src/modules/core'
import { AuthChecksService } from '../../../../src/modules/core/auth/auth-checks.service'
import { AuthService } from '../../../../src/modules/core/auth/auth.service'
import { UsersService } from '../../../../src/modules/core/users/users.service'
import { AuthSource, type User } from '../../../../src/modules/prisma'

const SUBJECT = 'dde84b4e-03ed-4990-a23b-e1be2e5eaf1a'
const checks: AuthChecks = { state: 'expected-state', nonce: 'expected-nonce', codeVerifier: 'expected-verifier' }
const callback = new URLSearchParams({ code: 'one-time-code', state: checks.state })
const session: AuthSession = { subject: SUBJECT, email: 'dev@coffra.local', accessToken: 'idp-access-token' }

const user: User = {
  id: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11',
  email: 'dev@coffra.local',
  authSource: AuthSource.oidc,
  externalSubject: SUBJECT,
  createdAt: new Date('2026-10-03T08:00:00Z'),
  updatedAt: new Date('2026-10-03T08:00:00Z'),
}

describe('AuthService', () => {
  const provider = {
    login: vi.fn<AuthProviderInterface['login']>(),
    validateSession: vi.fn<AuthProviderInterface['validateSession']>(),
    getUserInfo: vi.fn<AuthProviderInterface['getUserInfo']>(),
  }
  const checksService = { sign: vi.fn<AuthChecksService['sign']>(), verify: vi.fn<AuthChecksService['verify']>() }
  const upsertByExternalSubject = vi.fn<UsersService['upsertByExternalSubject']>()
  const service = new AuthService(
    provider,
    checksService as unknown as AuthChecksService,
    { upsertByExternalSubject } as unknown as UsersService,
  )

  beforeEach(() => {
    provider.login.mockReset()
    provider.validateSession.mockReset().mockResolvedValue(session)
    provider.getUserInfo.mockReset()
    checksService.sign.mockReset().mockResolvedValue('signed-checks')
    checksService.verify.mockReset().mockResolvedValue(checks)
    upsertByExternalSubject.mockReset().mockResolvedValue(user)
  })

  describe('startLogin', () => {
    it('returns the provider URL and the signed checks', async () => {
      provider.login.mockResolvedValue({ authorizationUrl: 'http://idp/auth?state=expected-state', checks })

      await expect(service.startLogin()).resolves.toEqual({
        authorizationUrl: 'http://idp/auth?state=expected-state',
        checksToken: 'signed-checks',
      })
      expect(checksService.sign).toHaveBeenCalledWith(checks)
    })

    it('does not sign anything when the provider fails', async () => {
      provider.login.mockRejectedValue(new Error('idp down'))

      await expect(service.startLogin()).rejects.toThrow('idp down')
      expect(checksService.sign).not.toHaveBeenCalled()
    })
  })

  describe('completeLogin', () => {
    it('validates the callback against the checks from the cookie and upserts the user', async () => {
      await expect(service.completeLogin(callback, 'cookie-token')).resolves.toBe(user)

      expect(checksService.verify).toHaveBeenCalledWith('cookie-token')
      expect(provider.validateSession).toHaveBeenCalledWith(callback, checks)
      expect(upsertByExternalSubject).toHaveBeenCalledExactlyOnceWith({ subject: SUBJECT, email: 'dev@coffra.local' })
      expect(provider.getUserInfo).not.toHaveBeenCalled()
    })

    it('asks the provider for the email when the ID token has none', async () => {
      const withoutEmail: AuthSession = { subject: SUBJECT, accessToken: 'idp-access-token' }
      provider.validateSession.mockResolvedValue(withoutEmail)
      provider.getUserInfo.mockResolvedValue({ subject: SUBJECT, email: 'userinfo@coffra.local' })

      await service.completeLogin(callback, 'cookie-token')

      expect(provider.getUserInfo).toHaveBeenCalledWith(withoutEmail)
      expect(upsertByExternalSubject).toHaveBeenCalledExactlyOnceWith({
        subject: SUBJECT,
        email: 'userinfo@coffra.local',
      })
    })

    it('does not validate the callback when the checks cookie is rejected', async () => {
      checksService.verify.mockRejectedValue(new UnauthorizedException('Login session missing or expired'))

      await expect(service.completeLogin(callback)).rejects.toThrow(UnauthorizedException)
      expect(provider.validateSession).not.toHaveBeenCalled()
      expect(upsertByExternalSubject).not.toHaveBeenCalled()
    })

    it('does not touch the user when the callback is rejected', async () => {
      const rejection = new UnauthorizedException('Authentication failed')
      provider.validateSession.mockRejectedValue(rejection)

      await expect(service.completeLogin(callback, 'cookie-token')).rejects.toBe(rejection)
      expect(upsertByExternalSubject).not.toHaveBeenCalled()
    })

    it('does not touch the user when the identity provider has no email', async () => {
      provider.validateSession.mockResolvedValue({ subject: SUBJECT, accessToken: 'idp-access-token' })
      provider.getUserInfo.mockRejectedValue(new UnauthorizedException('Authentication failed'))

      await expect(service.completeLogin(callback, 'cookie-token')).rejects.toThrow(UnauthorizedException)
      expect(upsertByExternalSubject).not.toHaveBeenCalled()
    })

    it('lets a database error through', async () => {
      upsertByExternalSubject.mockRejectedValue(new Error('db down'))

      await expect(service.completeLogin(callback, 'cookie-token')).rejects.toThrow('db down')
    })
  })

  it('resolves its dependencies through @Inject', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AUTH_PROVIDER, useValue: provider },
        { provide: AuthChecksService, useValue: checksService },
        { provide: UsersService, useValue: { upsertByExternalSubject } },
      ],
    }).compile()

    expect(moduleRef.get(AuthService)).toBeInstanceOf(AuthService)
  })
})
