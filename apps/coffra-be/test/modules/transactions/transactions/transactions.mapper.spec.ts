import { describe, expect, it } from 'vitest'

import { Prisma, type Transaction, TransactionType, TransferDirection } from '../../../../src/modules/prisma'
import { toTransactionView } from '../../../../src/modules/transactions/transactions/transactions.mapper'
import { TIME_ZONES, useTimeZone } from '../../../utils/use-time-zone'

const row = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: '9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d',
  accountId: '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d',
  type: TransactionType.expense,
  amount: new Prisma.Decimal('1250.5'),
  date: new Date('2026-10-19T00:00:00.000Z'),
  note: 'Lunch',
  categoryId: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f',
  transferPairId: null,
  transferDirection: null,
  createdAt: new Date('2026-10-19T08:00:00Z'),
  updatedAt: new Date('2026-10-19T08:00:00Z'),
  ...overrides,
})

describe('toTransactionView', () => {
  it('keeps the fields the API shows, the amount as a decimal string and the date as a calendar day', () => {
    expect(toTransactionView(row())).toStrictEqual({
      id: '9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d',
      accountId: '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d',
      type: 'expense',
      amount: '1250.5000',
      date: '2026-10-19',
      note: 'Lunch',
      categoryId: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f',
      transferPairId: null,
      transferDirection: null,
    })
  })

  it('leaves out the timestamps and whatever the query included, such as the account', () => {
    const view = toTransactionView({ ...row(), account: { currency: 'CZK' } } as Transaction)

    expect(Object.keys(view).toSorted()).toEqual([
      'accountId',
      'amount',
      'categoryId',
      'date',
      'id',
      'note',
      'transferDirection',
      'transferPairId',
      'type',
    ])
  })

  it('shows the pair and the direction of one side of a transfer', () => {
    const pairId = '1f2e3d4c-5b6a-4987-8a6b-5c4d3e2f1a0b'
    const view = toTransactionView(
      row({
        type: TransactionType.transfer,
        categoryId: null,
        transferPairId: pairId,
        transferDirection: TransferDirection.in,
      }),
    )

    expect(view).toMatchObject({ type: 'transfer', categoryId: null, transferPairId: pairId, transferDirection: 'in' })
  })

  it.each([
    ['0.0001', '0.0001'],
    ['999999999999999.9999', '999999999999999.9999'],
  ])('writes the amount %s as %s', (stored, expected) => {
    expect(toTransactionView(row({ amount: new Prisma.Decimal(stored) })).amount).toBe(expected)
  })

  describe.each(TIME_ZONES)('with the server in %s', (zone, offset) => {
    useTimeZone(zone, offset)

    it.each(['2026-10-19', '2024-02-29', '0001-01-01', '9999-12-31'])('shows the stored day %s as it is', (day) => {
      expect(toTransactionView(row({ date: new Date(`${day}T00:00:00.000Z`) })).date).toBe(day)
    })
  })
})
