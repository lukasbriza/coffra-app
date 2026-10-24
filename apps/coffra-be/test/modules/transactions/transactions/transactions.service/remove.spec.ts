import { ConflictException, NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { EDITABLE, OWNED_READ, OWNER, prismaError, TRANSACTION_ID, transferRow, useTransactionsService } from './setup'

describe('TransactionsService.remove', () => {
  const { service, findTransaction, remove } = useTransactionsService()

  it('reads the transaction within the owner scope first, then deletes with the scope and income or expense only', async () => {
    await expect(service.remove(OWNER, TRANSACTION_ID)).resolves.toBeUndefined()

    expect(findTransaction).toHaveBeenCalledExactlyOnceWith(OWNED_READ)
    expect(remove).toHaveBeenCalledExactlyOnceWith({ where: EDITABLE })
  })

  it('answers 404 without deleting when the scoped query finds nothing (missing or foreign)', async () => {
    findTransaction.mockResolvedValue(null)

    await expect(service.remove(OWNER, TRANSACTION_ID)).rejects.toThrow(NotFoundException)
    expect(remove).not.toHaveBeenCalled()
  })

  it('answers 409 without deleting one side of a transfer', async () => {
    findTransaction.mockResolvedValue(transferRow())

    const error = await service.remove(OWNER, TRANSACTION_ID).catch((error_: unknown) => error_)

    expect(error).toBeInstanceOf(ConflictException)
    expect((error as ConflictException).message).toBe('Transaction is part of a transfer and cannot be changed here')
    expect(remove).not.toHaveBeenCalled()
  })

  it('answers the same 404 when the transaction was deleted between the read and the delete', async () => {
    remove.mockRejectedValue(prismaError('P2025'))

    const error = await service.remove(OWNER, TRANSACTION_ID).catch((error_: unknown) => error_)

    expect(error).toBeInstanceOf(NotFoundException)
    expect((error as NotFoundException).message).toBe('Transaction not found')
  })

  it('passes any other error on unchanged: nothing refers to a transaction, so not even a foreign key error', async () => {
    const restricted = prismaError('P2003')
    const plain = new Error('connection lost')
    remove.mockRejectedValueOnce(restricted).mockRejectedValueOnce(plain)

    await expect(service.remove(OWNER, TRANSACTION_ID)).rejects.toBe(restricted)
    await expect(service.remove(OWNER, TRANSACTION_ID)).rejects.toBe(plain)
  })
})
