import { UnauthorizedException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { tokenPair, useAuthService, user } from './setup'

describe('AuthService.refresh', () => {
  const { service, tokensService, findById } = useAuthService()

  it('issues a new pair for the user and hands the refresh expiry on', async () => {
    await expect(service.refresh('refresh-jwt')).resolves.toBe(tokenPair)

    expect(tokensService.verifyRefresh).toHaveBeenCalledWith('refresh-jwt')
    expect(findById).toHaveBeenCalledExactlyOnceWith(user.id)
    expect(tokensService.issue).toHaveBeenCalledExactlyOnceWith(user.id, 1_900_000_000)
  })

  it('rejects a user that no longer exists and issues nothing', async () => {
    findById.mockResolvedValue(null)

    await expect(service.refresh('refresh-jwt')).rejects.toThrow(UnauthorizedException)
    expect(tokensService.issue).not.toHaveBeenCalled()
  })

  it('does not look the user up when the token is rejected', async () => {
    const rejection = new UnauthorizedException('Invalid or expired refresh token')
    tokensService.verifyRefresh.mockRejectedValue(rejection)

    await expect(service.refresh('forged')).rejects.toBe(rejection)
    expect(findById).not.toHaveBeenCalled()
    expect(tokensService.issue).not.toHaveBeenCalled()
  })

  it('verifies a missing token too, which the verifier rejects', async () => {
    tokensService.verifyRefresh.mockRejectedValue(new UnauthorizedException('Invalid or expired refresh token'))

    await expect(service.refresh()).rejects.toThrow(UnauthorizedException)
    expect(tokensService.verifyRefresh).toHaveBeenCalledWith(undefined)
  })

  it('lets a database error through', async () => {
    findById.mockRejectedValue(new Error('db down'))

    await expect(service.refresh('refresh-jwt')).rejects.toThrow('db down')
    expect(tokensService.issue).not.toHaveBeenCalled()
  })
})
