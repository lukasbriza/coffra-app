import { NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { OWNED_READ, OWNER, PAIR_ID, TRANSACTION_ID, transferRow, useTransactionsService, VIEW } from './setup'

describe('TransactionsService.findOne', () => {
  const { service, findTransaction } = useTransactionsService()

  it('reads the transaction within the owner scope, through its account', async () => {
    await service.findOne(OWNER, TRANSACTION_ID)

    expect(findTransaction).toHaveBeenCalledExactlyOnceWith(OWNED_READ)
  })

  it('returns the view: no timestamps, nothing of the account', async () => {
    await expect(service.findOne(OWNER, TRANSACTION_ID)).resolves.toStrictEqual(VIEW)
  })

  it('returns one side of a transfer too, with its pair and direction', async () => {
    findTransaction.mockResolvedValue(transferRow())

    await expect(service.findOne(OWNER, TRANSACTION_ID)).resolves.toMatchObject({
      type: 'transfer',
      categoryId: null,
      transferPairId: PAIR_ID,
      transferDirection: 'out',
    })
  })

  it('answers 404 when the scoped query finds nothing (missing or foreign)', async () => {
    findTransaction.mockResolvedValue(null)

    const error = await service.findOne(OWNER, TRANSACTION_ID).catch((error_: unknown) => error_)

    expect(error).toBeInstanceOf(NotFoundException)
    expect((error as NotFoundException).message).toBe('Transaction not found')
  })
})
