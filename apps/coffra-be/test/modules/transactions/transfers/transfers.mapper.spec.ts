import { describe, expect, it } from 'vitest'

import { Prisma, type Transaction, TransactionType, TransferDirection } from '../../../../src/modules/prisma'
import { toTransferPair, toTransferView } from '../../../../src/modules/transactions/transfers/transfers.mapper'
import { TIME_ZONES, useTimeZone } from '../../../utils/use-time-zone'

const PAIR_ID = '1f2e3d4c-5b6a-4987-8a6b-5c4d3e2f1a0b'
const FROM_ACCOUNT_ID = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d'
const TO_ACCOUNT_ID = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e'

const side = (transferDirection: TransferDirection, overrides: Partial<Transaction> = {}): Transaction => ({
  id:
    transferDirection === TransferDirection.out
      ? 'a1b2c3d4-0000-4000-8000-000000000001'
      : 'a1b2c3d4-0000-4000-8000-000000000002',
  accountId: transferDirection === TransferDirection.out ? FROM_ACCOUNT_ID : TO_ACCOUNT_ID,
  type: TransactionType.transfer,
  amount: new Prisma.Decimal('5000'),
  date: new Date('2026-10-21T00:00:00.000Z'),
  note: 'Savings',
  categoryId: null,
  transferPairId: PAIR_ID,
  transferDirection,
  createdAt: new Date('2026-10-21T08:00:00Z'),
  updatedAt: new Date('2026-10-21T08:00:00Z'),
  ...overrides,
})

const OUT = side(TransferDirection.out)
const IN = side(TransferDirection.in)

describe('toTransferPair', () => {
  it('takes the sides by their direction, in either order', () => {
    expect(toTransferPair([OUT, IN])).toStrictEqual({ out: OUT, in: IN })
    expect(toTransferPair([IN, OUT])).toStrictEqual({ out: OUT, in: IN })
  })

  it.each([
    ['no row', []],
    ['the out side alone', [OUT]],
    ['the in side alone', [IN]],
    ['two out sides', [OUT, side(TransferDirection.out)]],
    ['two in sides', [IN, side(TransferDirection.in)]],
    ['a third row', [OUT, IN, side(TransferDirection.in)]],
    [
      'sides of two transfers',
      [OUT, side(TransferDirection.in, { transferPairId: 'b2c3d4e5-0000-4000-8000-000000000003' })],
    ],
    [
      'an income instead of a side',
      [
        OUT,
        side(TransferDirection.in, { type: TransactionType.income, transferPairId: null, transferDirection: null }),
      ],
    ],
  ])('fails loudly for %s: a broken transfer is an error of the data', (_name, rows) => {
    expect(() => toTransferPair(rows)).toThrow('Broken transfer')
  })
})

describe('toTransferView', () => {
  it('shows the pair as one transfer: the pair id, both accounts, the amount as a decimal string, the day', () => {
    expect(toTransferView(toTransferPair([OUT, IN]))).toStrictEqual({
      pairId: PAIR_ID,
      fromAccountId: FROM_ACCOUNT_ID,
      toAccountId: TO_ACCOUNT_ID,
      amount: '5000.0000',
      date: '2026-10-21',
      note: 'Savings',
    })
  })

  it('leaves out the ids of the sides, the timestamps and whatever the query included, such as the account', () => {
    const view = toTransferView(toTransferPair([{ ...OUT, account: { currency: 'CZK' } } as Transaction, IN]))

    expect(Object.keys(view).toSorted()).toEqual(['amount', 'date', 'fromAccountId', 'note', 'pairId', 'toAccountId'])
  })

  it('shows no note as null', () => {
    const view = toTransferView(
      toTransferPair([side(TransferDirection.out, { note: null }), side(TransferDirection.in, { note: null })]),
    )

    expect(view.note).toBeNull()
  })

  it.each([
    ['0.0001', '0.0001'],
    ['999999999999999.9999', '999999999999999.9999'],
  ])('writes the amount %s as %s', (stored, expected) => {
    const amount = new Prisma.Decimal(stored)

    expect(
      toTransferView(toTransferPair([side(TransferDirection.out, { amount }), side(TransferDirection.in, { amount })]))
        .amount,
    ).toBe(expected)
  })

  describe.each(TIME_ZONES)('with the server in %s', (zone, offset) => {
    useTimeZone(zone, offset)

    it.each(['2026-10-21', '2024-02-29', '0001-01-01', '9999-12-31'])('shows the stored day %s as it is', (day) => {
      const date = new Date(`${day}T00:00:00.000Z`)

      expect(
        toTransferView(toTransferPair([side(TransferDirection.out, { date }), side(TransferDirection.in, { date })]))
          .date,
      ).toBe(day)
    })
  })
})
