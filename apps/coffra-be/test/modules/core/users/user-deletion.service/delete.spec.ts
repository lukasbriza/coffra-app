import { describe, expect, it } from 'vitest'

import { USER_DELETION_TIMEOUT_MS } from '../../../../../src/modules/core/users/constants'

import { OWNER, USER, useUserDeletionService } from './setup'

describe('UserDeletionService.delete', () => {
  const { service, log, tx, transactionClient, prisma, $transaction, erasers } = useUserDeletionService()

  it('reads the user, runs every eraser, then deletes the user, all inside one transaction', async () => {
    await service().delete(USER.id, { confirm: USER.email })

    expect(log).toStrictEqual(['transaction', 'findUnique', 'erase:transactions', 'erase:investments', 'delete'])
    expect($transaction).toHaveBeenCalledOnce()
  })

  it('reads and deletes the user by the id from the token, through the client of the transaction', async () => {
    await service().delete(USER.id, { confirm: USER.email })

    expect(tx.user.findUnique).toHaveBeenCalledExactlyOnceWith({ where: { id: USER.id } })
    expect(tx.user.delete).toHaveBeenCalledExactlyOnceWith({ where: { id: USER.id } })
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
    expect(prisma.user.delete).not.toHaveBeenCalled()
  })

  it('hands every eraser the owner of the user and the client of the same transaction', async () => {
    await service().delete(USER.id, { confirm: USER.email })

    expect(erasers.transactions.eraseOwnerData).toHaveBeenCalledExactlyOnceWith(OWNER, transactionClient)
    expect(erasers.investments.eraseOwnerData).toHaveBeenCalledExactlyOnceWith(OWNER, transactionClient)
  })

  it('runs the erasers one after another, never two at once on the one connection of the transaction', async () => {
    let running = 0
    let most = 0
    const slow = async (): Promise<void> => {
      running += 1
      most = Math.max(most, running)
      await new Promise((resolve) => {
        setTimeout(resolve, 5)
      })
      running -= 1
    }
    erasers.transactions.eraseOwnerData.mockImplementation(slow)
    erasers.investments.eraseOwnerData.mockImplementation(slow)

    await service().delete(USER.id, { confirm: USER.email })

    expect(most).toBe(1)
  })

  it('gives the transaction more time than the default of Prisma', async () => {
    await service().delete(USER.id, { confirm: USER.email })

    expect($transaction).toHaveBeenCalledWith(expect.any(Function), { timeout: USER_DELETION_TIMEOUT_MS })
    expect(USER_DELETION_TIMEOUT_MS).toBe(30_000)
  })

  it('resolves to nothing', async () => {
    await expect(service().delete(USER.id, { confirm: USER.email })).resolves.toBeUndefined()
  })
})
