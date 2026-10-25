import { ConflictException, NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { TIME_ZONES, useTimeZone } from '../../../../utils/use-time-zone'

import {
  accountRead,
  FROM_ACCOUNT_ID,
  INPUT,
  OWNER,
  pair,
  prismaError,
  TO_ACCOUNT_ID,
  useTransfersService,
  VIEW,
} from './setup'

const UUID_V4 = /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/

const rejection = async (promise: Promise<unknown>): Promise<unknown> => promise.catch((error_: unknown) => error_)

describe('TransfersService.create', () => {
  const { service, createManyAndReturn, findAccount } = useTransfersService()

  /** The rows of the one `createManyAndReturn` call. */
  const rowsOf = (call = 0): Record<string, unknown>[] =>
    (createManyAndReturn.mock.calls[call]?.[0] as { data: Record<string, unknown>[] }).data

  it('reads both accounts within the owner scope, the source first', async () => {
    await service.create(OWNER, INPUT)

    expect(findAccount.mock.calls).toEqual([[accountRead(FROM_ACCOUNT_ID)], [accountRead(TO_ACCOUNT_ID)]])
  })

  it('asks for both accounts at once, not one after the other', () => {
    findAccount.mockReturnValueOnce(
      new Promise(() => {
        // never answers: the target must be asked for all the same
      }),
    )

    void service.create(OWNER, INPUT)

    expect(findAccount).toHaveBeenCalledTimes(2)
  })

  it('writes both sides in one call: out on the source, in on the target, the same fields, no category', async () => {
    await service.create(OWNER, INPUT)

    expect(createManyAndReturn).toHaveBeenCalledOnce()
    const [out, incoming] = rowsOf()
    const shared = {
      type: 'transfer',
      transferPairId: out.transferPairId,
      amount: '5000',
      date: new Date('2026-10-21T00:00:00.000Z'),
      note: 'Savings',
    }

    expect(rowsOf()).toStrictEqual([
      { ...shared, accountId: FROM_ACCOUNT_ID, transferDirection: 'out' },
      { ...shared, accountId: TO_ACCOUNT_ID, transferDirection: 'in' },
    ])
    expect(incoming).not.toHaveProperty('categoryId')
  })

  it('pairs the sides with a new UUID v4, another one for every transfer', async () => {
    await service.create(OWNER, INPUT)
    await service.create(OWNER, INPUT)

    const [first, second] = [rowsOf(0)[0]?.transferPairId, rowsOf(1)[0]?.transferPairId]

    expect(first).toMatch(UUID_V4)
    expect(second).toMatch(UUID_V4)
    expect(first).not.toBe(second)
  })

  it('leaves the note out when the input has none, and writes null as it is', async () => {
    const { note: _note, ...withoutNote } = INPUT

    await service.create(OWNER, withoutNote)
    await service.create(OWNER, { ...INPUT, note: null })

    expect(rowsOf(0).map((row) => 'note' in row)).toEqual([false, false])
    expect(rowsOf(1).map((row) => row.note)).toEqual([null, null])
  })

  describe.each(TIME_ZONES.filter(([zone]) => zone !== 'UTC'))('with the server in %s', (zone, offset) => {
    useTimeZone(zone, offset)

    it('writes the date of both sides as midnight UTC of the day', async () => {
      await service.create(OWNER, { ...INPUT, date: '2024-02-29' })

      expect(rowsOf().map((row) => (row.date as Date).toISOString())).toEqual([
        '2024-02-29T00:00:00.000Z',
        '2024-02-29T00:00:00.000Z',
      ])
    })
  })

  it('returns the view of the written pair, whatever order the rows come back in', async () => {
    await expect(service.create(OWNER, INPUT)).resolves.toStrictEqual(VIEW)

    createManyAndReturn.mockResolvedValue(pair().toReversed())

    await expect(service.create(OWNER, INPUT)).resolves.toStrictEqual(VIEW)
  })

  it.each([
    ['the source', 0],
    ['the target', 1],
  ])('answers 404 without writing when %s is not among the accounts of the owner', async (_name, missing) => {
    findAccount.mockImplementation((args) =>
      Promise.resolve(
        (args as { where: { id: string } }).where.id === [FROM_ACCOUNT_ID, TO_ACCOUNT_ID][missing]
          ? null
          : { currency: 'CZK' },
      ),
    )

    const error = await rejection(service.create(OWNER, INPUT))

    expect(error).toBeInstanceOf(NotFoundException)
    expect((error as NotFoundException).message).toBe('Account not found')
    expect(createManyAndReturn).not.toHaveBeenCalled()
  })

  it('answers 409 without writing when the accounts have different currencies', async () => {
    findAccount.mockResolvedValueOnce({ currency: 'CZK' }).mockResolvedValueOnce({ currency: 'EUR' })

    const error = await rejection(service.create(OWNER, INPUT))

    expect(error).toBeInstanceOf(ConflictException)
    expect((error as ConflictException).message).toBe('A transfer needs two accounts in the same currency')
    expect(createManyAndReturn).not.toHaveBeenCalled()
  })

  it('answers the same 404 when an account was deleted between the check and the write (foreign key)', async () => {
    createManyAndReturn.mockRejectedValue(prismaError('P2003'))
    findAccount
      .mockResolvedValueOnce({ currency: 'CZK' })
      .mockResolvedValueOnce({ currency: 'CZK' })
      .mockResolvedValueOnce({ currency: 'CZK' })
      .mockResolvedValueOnce(null)

    const error = await rejection(service.create(OWNER, INPUT))

    expect(error).toBeInstanceOf(NotFoundException)
    expect((error as NotFoundException).message).toBe('Account not found')
    expect(findAccount).toHaveBeenCalledTimes(4)
  })

  it('passes the foreign key error on when both accounts are still there', async () => {
    const failure = prismaError('P2003')
    createManyAndReturn.mockRejectedValue(failure)

    await expect(service.create(OWNER, INPUT)).rejects.toBe(failure)
  })

  it('passes any other error on unchanged, without reading the accounts again', async () => {
    const unique = prismaError('P2002')
    const plain = new Error('connection lost')
    createManyAndReturn.mockRejectedValueOnce(unique).mockRejectedValueOnce(plain)

    await expect(service.create(OWNER, INPUT)).rejects.toBe(unique)
    await expect(service.create(OWNER, INPUT)).rejects.toBe(plain)
    expect(findAccount).toHaveBeenCalledTimes(4)
  })

  it('fails loudly, not with a 404, when the write does not return one out and one in side', async () => {
    createManyAndReturn.mockResolvedValue([])

    const error = await rejection(service.create(OWNER, INPUT))

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(NotFoundException)
  })
})
