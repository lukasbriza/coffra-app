import { describe, expect, it } from 'vitest'

import { useAuthService } from './setup'

describe('AuthService.logout', () => {
  const { service, provider, tokensService, upsertByExternalSubject, findById } = useAuthService()

  it('returns the end-session URL from the provider and touches nothing else', async () => {
    provider.logout.mockResolvedValue({ endSessionUrl: 'http://idp/logout?client_id=coffra-be' })

    await expect(service.logout()).resolves.toEqual({ endSessionUrl: 'http://idp/logout?client_id=coffra-be' })

    expect(upsertByExternalSubject).not.toHaveBeenCalled()
    expect(findById).not.toHaveBeenCalled()
    expect(tokensService.issue).not.toHaveBeenCalled()
    expect(tokensService.verifyRefresh).not.toHaveBeenCalled()
  })

  it('passes a missing end-session endpoint on as null', async () => {
    provider.logout.mockResolvedValue({ endSessionUrl: null })

    await expect(service.logout()).resolves.toEqual({ endSessionUrl: null })
  })

  it('lets a provider error through', async () => {
    provider.logout.mockRejectedValue(new Error('idp down'))

    await expect(service.logout()).rejects.toThrow('idp down')
  })
})
