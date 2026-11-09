import { describe, expect, it } from 'vitest'

import { prismaError } from '../../../transactions/prisma-error'

import { USER, useUserDeletionService } from './setup'

describe('UserDeletionService.delete: a failure half way', () => {
  const { service, log, erasers, tx } = useUserDeletionService()

  it('lets the error of an eraser through (so the transaction rolls back) and runs nothing after it', async () => {
    const error = prismaError('P2003')
    erasers.transactions.eraseOwnerData.mockRejectedValue(error)

    await expect(service().delete(USER.id, { confirm: USER.email })).rejects.toBe(error)

    expect(log).toStrictEqual(['transaction', 'findUnique'])
    expect(erasers.investments.eraseOwnerData).not.toHaveBeenCalled()
    expect(tx.user.delete).not.toHaveBeenCalled()
  })

  it('lets the error of the last eraser through and does not delete the user', async () => {
    const error = new Error('lost connection')
    erasers.investments.eraseOwnerData.mockRejectedValue(error)

    await expect(service().delete(USER.id, { confirm: USER.email })).rejects.toBe(error)

    expect(tx.user.delete).not.toHaveBeenCalled()
  })

  it('lets the error of deleting the user through unchanged, not as a 401 or a 404 (P2025: gone in between)', async () => {
    const error = prismaError('P2025')
    tx.user.delete.mockRejectedValue(error)

    await expect(service().delete(USER.id, { confirm: USER.email })).rejects.toBe(error)
  })
})
