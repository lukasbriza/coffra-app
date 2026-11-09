import { describe, expect, it } from 'vitest'

import { prismaError } from '../../prisma-error'

import { OWNER, useTransactionsDataEraser } from './setup'

describe('TransactionsDataEraser.eraseOwnerData', () => {
  const { eraser, tx, client, log } = useTransactionsDataEraser()

  it('deletes the transactions first, then the accounts and the categories they refer to (both keys are Restrict)', async () => {
    await eraser.eraseOwnerData(OWNER, client)

    expect(log).toStrictEqual(['transaction', 'account', 'category'])
  })

  it('deletes the transactions of the owner through their account, transfers included', async () => {
    await eraser.eraseOwnerData(OWNER, client)

    expect(tx.transaction.deleteMany).toHaveBeenCalledExactlyOnceWith({ where: { account: { userId: OWNER.userId } } })
  })

  it('deletes the accounts and the categories of the owner, and nothing else', async () => {
    await eraser.eraseOwnerData(OWNER, client)

    expect(tx.account.deleteMany).toHaveBeenCalledExactlyOnceWith({ where: { userId: OWNER.userId } })
    expect(tx.category.deleteMany).toHaveBeenCalledExactlyOnceWith({ where: { userId: OWNER.userId } })
  })

  it('gives each owner a filter of its own', async () => {
    const other = { userId: '7d1c2b9a-5e4f-4a3b-8c2d-1e0f9a8b7c62' }

    await eraser.eraseOwnerData(other, client)

    expect(tx.account.deleteMany).toHaveBeenCalledExactlyOnceWith({ where: { userId: other.userId } })
  })

  it('stops at the first failure and lets it through, so the transaction of the deletion rolls back', async () => {
    const error = prismaError('P2003')
    tx.account.deleteMany.mockRejectedValueOnce(error)

    await expect(eraser.eraseOwnerData(OWNER, client)).rejects.toBe(error)

    expect(log).toStrictEqual(['transaction'])
    expect(tx.category.deleteMany).not.toHaveBeenCalled()
  })

  it('resolves to nothing', async () => {
    await expect(eraser.eraseOwnerData(OWNER, client)).resolves.toBeUndefined()
  })
})
