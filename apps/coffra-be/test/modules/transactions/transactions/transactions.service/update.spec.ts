import { ConflictException, NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import {
  ACCOUNT_ID,
  accountRead,
  CATEGORY_ID,
  categoryRead,
  EDITABLE,
  OTHER_ACCOUNT_ID,
  OWNED_READ,
  OWNER,
  prismaError,
  row,
  TRANSACTION_ID,
  transferRow,
  useTransactionsService,
  VIEW,
} from './setup'

const rejection = async (promise: Promise<unknown>): Promise<unknown> => promise.catch((error_: unknown) => error_)

describe('TransactionsService.update', () => {
  const { service, findTransaction, update, findAccount, findCategory } = useTransactionsService()

  const dataOf = (): unknown => (update.mock.calls[0]?.[0] as { data: unknown }).data

  it('reads the transaction within the owner scope first, then writes with the scope and income or expense only', async () => {
    await service.update(OWNER, TRANSACTION_ID, { amount: '99.9' })

    expect(findTransaction).toHaveBeenCalledExactlyOnceWith(OWNED_READ)
    expect(update).toHaveBeenCalledExactlyOnceWith({ where: EDITABLE, data: { amount: '99.9' } })
  })

  it('writes nothing but the timestamp for an empty input, and reads no account or category', async () => {
    await service.update(OWNER, TRANSACTION_ID, {})

    expect(dataOf()).toStrictEqual({})
    expect(findAccount).not.toHaveBeenCalled()
    expect(findCategory).not.toHaveBeenCalled()
  })

  it('writes the changed fields, the date as midnight UTC', async () => {
    await service.update(OWNER, TRANSACTION_ID, { type: 'income', amount: '10', date: '2024-02-29', note: 'Salary' })

    expect(dataOf()).toStrictEqual({
      type: 'income',
      amount: '10',
      date: new Date('2024-02-29T00:00:00.000Z'),
      note: 'Salary',
    })
  })

  it('clears the category and the note with null, without looking for a category', async () => {
    await service.update(OWNER, TRANSACTION_ID, { categoryId: null, note: null })

    expect(dataOf()).toStrictEqual({ categoryId: null, note: null })
    expect(findCategory).not.toHaveBeenCalled()
  })

  it('returns the view of the changed row', async () => {
    await expect(service.update(OWNER, TRANSACTION_ID, {})).resolves.toStrictEqual(VIEW)
  })

  it('answers 404 without reading anything else or writing when the transaction is missing or foreign', async () => {
    findTransaction.mockResolvedValue(null)

    const error = await rejection(service.update(OWNER, TRANSACTION_ID, { categoryId: CATEGORY_ID }))

    expect(error).toBeInstanceOf(NotFoundException)
    expect((error as NotFoundException).message).toBe('Transaction not found')
    expect(findCategory).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  it('answers 409 without writing for one side of a transfer, even with an empty input', async () => {
    findTransaction.mockResolvedValue(transferRow())

    const error = await rejection(service.update(OWNER, TRANSACTION_ID, {}))

    expect(error).toBeInstanceOf(ConflictException)
    expect((error as ConflictException).message).toBe('Transaction is part of a transfer and cannot be changed here')
    expect(update).not.toHaveBeenCalled()
  })

  describe('a category', () => {
    it('is read within the owner scope and written', async () => {
      await service.update(OWNER, TRANSACTION_ID, { categoryId: CATEGORY_ID })

      expect(findCategory).toHaveBeenCalledExactlyOnceWith(categoryRead(CATEGORY_ID))
      expect(dataOf()).toStrictEqual({ categoryId: CATEGORY_ID })
    })

    it('that is not among those of the owner answers 404 without writing', async () => {
      findCategory.mockResolvedValue(null)

      const error = await rejection(service.update(OWNER, TRANSACTION_ID, { categoryId: CATEGORY_ID }))

      expect((error as NotFoundException).message).toBe('Category not found')
      expect(update).not.toHaveBeenCalled()
    })
  })

  describe('a move to another account', () => {
    it('reads the new account within the owner scope and moves the transaction when the currency is the same', async () => {
      await service.update(OWNER, TRANSACTION_ID, { accountId: OTHER_ACCOUNT_ID })

      expect(findAccount).toHaveBeenCalledExactlyOnceWith(accountRead(OTHER_ACCOUNT_ID))
      expect(dataOf()).toStrictEqual({ accountId: OTHER_ACCOUNT_ID })
    })

    it('answers 409 without writing when the new account has another currency', async () => {
      findAccount.mockResolvedValue({ currency: 'EUR' })

      const error = await rejection(service.update(OWNER, TRANSACTION_ID, { accountId: OTHER_ACCOUNT_ID }))

      expect(error).toBeInstanceOf(ConflictException)
      expect((error as ConflictException).message).toBe('A transaction cannot move to an account in another currency')
      expect(update).not.toHaveBeenCalled()
    })

    it('answers 404 without writing when the new account is not among those of the owner', async () => {
      findAccount.mockResolvedValue(null)

      const error = await rejection(service.update(OWNER, TRANSACTION_ID, { accountId: OTHER_ACCOUNT_ID }))

      expect(error).toBeInstanceOf(NotFoundException)
      expect((error as NotFoundException).message).toBe('Account not found')
      expect(update).not.toHaveBeenCalled()
    })

    it('is no move to the account it already has: nothing is read or compared', async () => {
      findTransaction.mockResolvedValue(row({ account: { currency: 'EUR' } }))

      await service.update(OWNER, TRANSACTION_ID, { accountId: ACCOUNT_ID })

      expect(findAccount).not.toHaveBeenCalled()
      expect(dataOf()).toStrictEqual({ accountId: ACCOUNT_ID })
    })
  })

  it('answers the same 404 when the transaction was deleted between the read and the write', async () => {
    update.mockRejectedValue(prismaError('P2025'))

    const error = await rejection(service.update(OWNER, TRANSACTION_ID, { amount: '10' }))

    expect(error).toBeInstanceOf(NotFoundException)
    expect((error as NotFoundException).message).toBe('Transaction not found')
  })

  it('answers the 404 of the new account when it was deleted between the check and the write (foreign key)', async () => {
    update.mockRejectedValue(prismaError('P2003'))
    findAccount.mockResolvedValueOnce({ currency: 'CZK' }).mockResolvedValueOnce(null)

    const error = await rejection(service.update(OWNER, TRANSACTION_ID, { accountId: OTHER_ACCOUNT_ID }))

    expect((error as NotFoundException).message).toBe('Account not found')
  })

  it('passes the foreign key error on when the references are both still there', async () => {
    const failure = prismaError('P2003')
    update.mockRejectedValue(failure)

    await expect(service.update(OWNER, TRANSACTION_ID, { accountId: OTHER_ACCOUNT_ID })).rejects.toBe(failure)
  })

  it('passes any other error on unchanged', async () => {
    const failure = new Error('connection lost')
    update.mockRejectedValue(failure)

    await expect(service.update(OWNER, TRANSACTION_ID, { amount: '10' })).rejects.toBe(failure)
  })
})
