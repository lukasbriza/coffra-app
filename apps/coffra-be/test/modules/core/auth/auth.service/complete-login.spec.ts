import { UnauthorizedException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import type { AuthSession } from '../../../../../src/modules/core'

import { callback, checks, SUBJECT, tokenPair, useAuthService, user } from './setup'

describe('AuthService.completeLogin', () => {
  const { service, provider, checksService, tokensService, upsertByExternalSubject } = useAuthService()

  it('validates the callback against the checks from the cookie, upserts the user and issues its tokens', async () => {
    await expect(service.completeLogin(callback, 'cookie-token')).resolves.toBe(tokenPair)

    expect(checksService.verify).toHaveBeenCalledWith('cookie-token')
    expect(provider.validateSession).toHaveBeenCalledWith(callback, checks)
    expect(upsertByExternalSubject).toHaveBeenCalledExactlyOnceWith({ subject: SUBJECT, email: 'dev@coffra.local' })
    expect(tokensService.issue).toHaveBeenCalledExactlyOnceWith(user.id)
    expect(provider.getUserInfo).not.toHaveBeenCalled()
  })

  it('issues a fresh session: no inherited refresh expiry', async () => {
    await service.completeLogin(callback, 'cookie-token')

    expect(tokensService.issue.mock.calls[0]).toHaveLength(1)
  })

  it('issues the tokens only after the user is resolved', async () => {
    await service.completeLogin(callback, 'cookie-token')

    expect(upsertByExternalSubject.mock.invocationCallOrder[0]).toBeLessThan(
      tokensService.issue.mock.invocationCallOrder[0] ?? 0,
    )
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
    expect(tokensService.issue).not.toHaveBeenCalled()
  })

  it('does not touch the user or issue tokens when the callback is rejected', async () => {
    const rejection = new UnauthorizedException('Authentication failed')
    provider.validateSession.mockRejectedValue(rejection)

    await expect(service.completeLogin(callback, 'cookie-token')).rejects.toBe(rejection)
    expect(upsertByExternalSubject).not.toHaveBeenCalled()
    expect(tokensService.issue).not.toHaveBeenCalled()
  })

  it('does not touch the user or issue tokens when the identity provider has no email', async () => {
    provider.validateSession.mockResolvedValue({ subject: SUBJECT, accessToken: 'idp-access-token' })
    provider.getUserInfo.mockRejectedValue(new UnauthorizedException('Authentication failed'))

    await expect(service.completeLogin(callback, 'cookie-token')).rejects.toThrow(UnauthorizedException)
    expect(upsertByExternalSubject).not.toHaveBeenCalled()
    expect(tokensService.issue).not.toHaveBeenCalled()
  })

  it('lets a database error through and issues no tokens', async () => {
    upsertByExternalSubject.mockRejectedValue(new Error('db down'))

    await expect(service.completeLogin(callback, 'cookie-token')).rejects.toThrow('db down')
    expect(tokensService.issue).not.toHaveBeenCalled()
  })
})
