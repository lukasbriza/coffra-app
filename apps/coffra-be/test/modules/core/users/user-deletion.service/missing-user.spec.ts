import { UnauthorizedException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { USER, useUserDeletionService } from './setup'

describe('UserDeletionService.delete: a user that no longer exists', () => {
  const { service, log, erasers, tx } = useUserDeletionService()

  it('answers 401 like GET /api/users/me and a refresh, and deletes nothing', async () => {
    tx.user.findUnique.mockResolvedValue(null)

    const failure = service().delete(USER.id, { confirm: USER.email })

    await expect(failure).rejects.toThrow(UnauthorizedException)
    await expect(failure).rejects.toThrow('Invalid or expired access token')
    expect(log).toStrictEqual(['transaction'])
    expect(erasers.transactions.eraseOwnerData).not.toHaveBeenCalled()
    expect(erasers.investments.eraseOwnerData).not.toHaveBeenCalled()
    expect(tx.user.delete).not.toHaveBeenCalled()
  })
})
