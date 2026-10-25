import { ConflictException, NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { TransferDirection } from '../../../../../src/modules/prisma'

import {
  accountRead,
  FROM_ACCOUNT_ID,
  OTHER_ACCOUNT_ID,
  OWNER,
  PAIR_ID,
  PAIR_READ,
  pair,
  prismaError,
  side,
  sideWhere,
  TO_ACCOUNT_ID,
  useTransfersService,
  VIEW,
} from './setup'

const rejection = async (promise: Promise<unknown>): Promise<unknown> => promise.catch((error_: unknown) => error_)

describe('TransfersService.update', () => {
  const { service, findMany, update, findAccount, $transaction } = useTransfersService()

  /** The `data` of the write of each side, in the order of the writes. */
  const dataOf = (): unknown[] => update.mock.calls.map(([args]) => (args as unknown as { data: unknown }).data)

  it('reads both sides within the owner scope first, then writes each side with the scope, out first', async () => {
    await service.update(OWNER, PAIR_ID, { amount: '99.9' })

    expect(findMany).toHaveBeenCalledExactlyOnceWith(PAIR_READ)
    expect(update.mock.calls).toEqual([
      [{ where: sideWhere(TransferDirection.out), data: { amount: '99.9' } }],
      [{ where: sideWhere(TransferDirection.in), data: { amount: '99.9' } }],
    ])
  })

  it('writes both sides in one database transaction', async () => {
    await service.update(OWNER, PAIR_ID, { amount: '99.9' })

    expect($transaction).toHaveBeenCalledOnce()
    expect($transaction.mock.calls[0]?.[0]).toStrictEqual(update.mock.results.map(({ value }) => value as unknown))
  })

  it('writes the amount, the date as midnight UTC and the note on both sides alike', async () => {
    await service.update(OWNER, PAIR_ID, { amount: '10', date: '2024-02-29', note: 'Rent' })

    const data = { amount: '10', date: new Date('2024-02-29T00:00:00.000Z'), note: 'Rent' }
    expect(dataOf()).toStrictEqual([data, data])
  })

  it('clears the note of both sides with null', async () => {
    await service.update(OWNER, PAIR_ID, { note: null })

    expect(dataOf()).toStrictEqual([{ note: null }, { note: null }])
  })

  it('writes nothing but the timestamps for an empty input, and reads no account', async () => {
    await service.update(OWNER, PAIR_ID, {})

    expect(dataOf()).toStrictEqual([{}, {}])
    expect(findAccount).not.toHaveBeenCalled()
  })

  it('returns the view of the written pair', async () => {
    await expect(service.update(OWNER, PAIR_ID, {})).resolves.toStrictEqual(VIEW)
  })

  it('answers 404 without reading anything else or writing when the transfer is missing or foreign', async () => {
    findMany.mockResolvedValue([])

    const error = await rejection(service.update(OWNER, PAIR_ID, { fromAccountId: OTHER_ACCOUNT_ID }))

    expect(error).toBeInstanceOf(NotFoundException)
    expect((error as NotFoundException).message).toBe('Transfer not found')
    expect(findAccount).not.toHaveBeenCalled()
    expect($transaction).not.toHaveBeenCalled()
  })

  it('fails loudly, not with a 404 and without writing, when the stored transfer is not one out and one in side', async () => {
    findMany.mockResolvedValue([side(TransferDirection.out)])

    const error = await rejection(service.update(OWNER, PAIR_ID, { amount: '10' }))

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(NotFoundException)
    expect($transaction).not.toHaveBeenCalled()
  })

  it('takes the sides by their direction, whatever order the read returns them in', async () => {
    findMany.mockResolvedValue(pair().toReversed())

    await service.update(OWNER, PAIR_ID, { toAccountId: FROM_ACCOUNT_ID, fromAccountId: TO_ACCOUNT_ID })

    expect(dataOf()).toStrictEqual([{ accountId: TO_ACCOUNT_ID }, { accountId: FROM_ACCOUNT_ID }])
  })

  describe('a move to another account', () => {
    it('of the source reads the new account within the owner scope and writes it on the out side only', async () => {
      await service.update(OWNER, PAIR_ID, { fromAccountId: OTHER_ACCOUNT_ID })

      expect(findAccount).toHaveBeenCalledExactlyOnceWith(accountRead(OTHER_ACCOUNT_ID))
      expect(dataOf()).toStrictEqual([{ accountId: OTHER_ACCOUNT_ID }, {}])
    })

    it('of the target reads the new account within the owner scope and writes it on the in side only', async () => {
      await service.update(OWNER, PAIR_ID, { toAccountId: OTHER_ACCOUNT_ID })

      expect(findAccount).toHaveBeenCalledExactlyOnceWith(accountRead(OTHER_ACCOUNT_ID))
      expect(dataOf()).toStrictEqual([{}, { accountId: OTHER_ACCOUNT_ID }])
    })

    it('of both sides at once swaps the direction of the transfer', async () => {
      await service.update(OWNER, PAIR_ID, { fromAccountId: TO_ACCOUNT_ID, toAccountId: FROM_ACCOUNT_ID })

      expect(findAccount.mock.calls).toEqual([[accountRead(TO_ACCOUNT_ID)], [accountRead(FROM_ACCOUNT_ID)]])
      expect(dataOf()).toStrictEqual([{ accountId: TO_ACCOUNT_ID }, { accountId: FROM_ACCOUNT_ID }])
    })

    it('is no move to the account a side already has: nothing is read or written for it', async () => {
      findMany.mockResolvedValue(pair().map((row) => ({ ...row, account: { currency: 'EUR' } })))

      await service.update(OWNER, PAIR_ID, { fromAccountId: FROM_ACCOUNT_ID, toAccountId: TO_ACCOUNT_ID })

      expect(findAccount).not.toHaveBeenCalled()
      expect(dataOf()).toStrictEqual([{}, {}])
    })

    it.each([
      ['the target to the source', { toAccountId: FROM_ACCOUNT_ID }],
      ['the source to the target', { fromAccountId: TO_ACCOUNT_ID }],
    ])(
      'answers 409 without reading or writing when moving %s would leave one account on both sides',
      async (_name, input) => {
        const error = await rejection(service.update(OWNER, PAIR_ID, input))

        expect(error).toBeInstanceOf(ConflictException)
        expect((error as ConflictException).message).toBe('A transfer needs two different accounts')
        expect(findAccount).not.toHaveBeenCalled()
        expect($transaction).not.toHaveBeenCalled()
      },
    )

    it('answers 404 without writing when the new account is not among those of the owner', async () => {
      findAccount.mockResolvedValue(null)

      const error = await rejection(service.update(OWNER, PAIR_ID, { toAccountId: OTHER_ACCOUNT_ID }))

      expect(error).toBeInstanceOf(NotFoundException)
      expect((error as NotFoundException).message).toBe('Account not found')
      expect($transaction).not.toHaveBeenCalled()
    })

    it.each([
      ['the source', { fromAccountId: OTHER_ACCOUNT_ID }],
      ['the target', { toAccountId: OTHER_ACCOUNT_ID }],
    ])('answers 409 without writing when the new account of %s has another currency', async (_name, input) => {
      findAccount.mockResolvedValue({ currency: 'EUR' })

      const error = await rejection(service.update(OWNER, PAIR_ID, input))

      expect(error).toBeInstanceOf(ConflictException)
      expect((error as ConflictException).message).toBe('A transfer cannot move to an account in another currency')
      expect($transaction).not.toHaveBeenCalled()
    })

    it('answers 409 when both sides move to accounts of one currency that is not the one of the transfer', async () => {
      findAccount.mockResolvedValue({ currency: 'EUR' })

      const error = await rejection(
        service.update(OWNER, PAIR_ID, { fromAccountId: OTHER_ACCOUNT_ID, toAccountId: FROM_ACCOUNT_ID }),
      )

      expect(error).toBeInstanceOf(ConflictException)
      expect($transaction).not.toHaveBeenCalled()
    })
  })

  it('answers the same 404 when the transfer was deleted between the read and the write', async () => {
    update.mockRejectedValue(prismaError('P2025'))

    const error = await rejection(service.update(OWNER, PAIR_ID, { amount: '10' }))

    expect(error).toBeInstanceOf(NotFoundException)
    expect((error as NotFoundException).message).toBe('Transfer not found')
  })

  it('answers the 404 of the new account when it was deleted between the check and the write (foreign key)', async () => {
    update.mockRejectedValue(prismaError('P2003'))
    findAccount.mockResolvedValueOnce({ currency: 'CZK' }).mockResolvedValueOnce(null)

    const error = await rejection(service.update(OWNER, PAIR_ID, { toAccountId: OTHER_ACCOUNT_ID }))

    expect(error).toBeInstanceOf(NotFoundException)
    expect((error as NotFoundException).message).toBe('Account not found')
  })

  it('passes the foreign key error on when the new account is still there', async () => {
    const failure = prismaError('P2003')
    update.mockRejectedValue(failure)

    await expect(service.update(OWNER, PAIR_ID, { toAccountId: OTHER_ACCOUNT_ID })).rejects.toBe(failure)
  })

  it('passes any other error on unchanged', async () => {
    const failure = new Error('connection lost')
    update.mockRejectedValue(failure)

    await expect(service.update(OWNER, PAIR_ID, { amount: '10' })).rejects.toBe(failure)
  })
})
