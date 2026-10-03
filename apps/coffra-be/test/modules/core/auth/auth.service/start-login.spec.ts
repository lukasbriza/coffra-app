import { describe, expect, it } from 'vitest'

import { checks, useAuthService } from './setup'

describe('AuthService.startLogin', () => {
  const { service, provider, checksService } = useAuthService()

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
