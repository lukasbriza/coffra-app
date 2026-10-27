import { describe, expect, it } from 'vitest'

import { Prisma, TransactionType } from '../../../../../src/modules/prisma'
import { formatMoney } from '../../../../../src/modules/transactions/common/format-money'
import type { DailyGroupedTotal, DayTotal } from '../../../../../src/modules/transactions/totals/totals.types'
import { foldDays } from '../../../../../src/modules/transactions/totals/utils/fold-days'

const CZK_1 = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d'
const CZK_2 = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e'
const EUR_1 = '7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f'

const CURRENCIES = new Map([
  [CZK_1, 'CZK'],
  [CZK_2, 'CZK'],
  [EUR_1, 'EUR'],
])

const group = (accountId: string, date: string, type: TransactionType, amount: string): DailyGroupedTotal => ({
  accountId,
  date,
  type,
  total: new Prisma.Decimal(amount),
})

const income = (accountId: string, date: string, amount: string) =>
  group(accountId, date, TransactionType.income, amount)
const expense = (accountId: string, date: string, amount: string) =>
  group(accountId, date, TransactionType.expense, amount)

const fold = (groups: DailyGroupedTotal[]) => foldDays(groups, CURRENCIES)

/** The rows as `currency|day|income|expense`, in the order they came, to compare at a glance. */
const lines = (rows: DayTotal[]): string[] =>
  rows.map(
    ({ currency, date, income: inc, expense: exp }) => `${currency}|${date}|${formatMoney(inc)}|${formatMoney(exp)}`,
  )

describe('foldDays', () => {
  it('returns no rows for no groups', () => {
    expect(fold([])).toStrictEqual([])
  })

  it('makes a row of the currency of the account and the day', () => {
    const [row] = fold([income(CZK_1, '2026-09-01', '100')])

    expect(row).toMatchObject({ currency: 'CZK', date: '2026-09-01' })
  })

  it('gives the side without a transaction as zero, income only and expense only alike', () => {
    expect(lines(fold([income(CZK_1, '2026-09-01', '100'), expense(CZK_1, '2026-09-02', '30')]))).toStrictEqual([
      'CZK|2026-09-01|100.0000|0.0000',
      'CZK|2026-09-02|0.0000|30.0000',
    ])
  })

  it('puts income and expense of the same day in one row', () => {
    expect(lines(fold([income(CZK_1, '2026-09-01', '10'), expense(CZK_1, '2026-09-01', '4.5')]))).toStrictEqual([
      'CZK|2026-09-01|10.0000|4.5000',
    ])
  })

  it('adds the groups of two accounts in the same currency on the same day into one row', () => {
    expect(lines(fold([expense(CZK_1, '2026-09-01', '100'), expense(CZK_2, '2026-09-01', '50.5')]))).toStrictEqual([
      'CZK|2026-09-01|0.0000|150.5000',
    ])
  })

  it('keeps days apart, the same account on two days is two rows', () => {
    expect(lines(fold([expense(CZK_1, '2026-09-01', '100'), expense(CZK_1, '2026-09-02', '10')]))).toStrictEqual([
      'CZK|2026-09-01|0.0000|100.0000',
      'CZK|2026-09-02|0.0000|10.0000',
    ])
  })

  it('keeps currencies apart, the same day in two currencies is two rows', () => {
    expect(lines(fold([expense(CZK_1, '2026-09-01', '100'), expense(EUR_1, '2026-09-01', '10')]))).toStrictEqual([
      'CZK|2026-09-01|0.0000|100.0000',
      'EUR|2026-09-01|0.0000|10.0000',
    ])
  })

  describe('the order of the rows', () => {
    const groups = [
      expense(EUR_1, '2026-09-01', '1'),
      expense(CZK_1, '2026-10-01', '2'),
      expense(CZK_1, '2026-09-30', '3'),
      income(CZK_1, '2025-12-31', '4'),
      expense(CZK_1, '2026-01-01', '5'),
    ]

    it('is the currency, then the day, across the turn of a month and of a year', () => {
      expect(lines(fold(groups))).toStrictEqual([
        'CZK|2025-12-31|4.0000|0.0000',
        'CZK|2026-01-01|0.0000|5.0000',
        'CZK|2026-09-30|0.0000|3.0000',
        'CZK|2026-10-01|0.0000|2.0000',
        'EUR|2026-09-01|0.0000|1.0000',
      ])
    })

    it('does not depend on the order of the groups', () => {
      expect(lines(fold(groups.toReversed()))).toStrictEqual(lines(fold(groups)))
    })
  })

  describe('the amounts', () => {
    const FULL = '999999999999999.9999'

    it('stay exact beyond the 20 digits of the default decimal, one account after another', () => {
      const accounts = new Map(Array.from({ length: 20 }, (_, i) => [`account-${i}`, 'CZK'] as const))
      const groups = [...accounts.keys()].map((accountId) => expense(accountId, '2026-09-01', FULL))

      const [row] = foldDays(groups, accounts)

      expect(formatMoney(row.expense)).toBe('19999999999999999.9980')
    })

    it('are exact where a floating point number is not', () => {
      const [row] = fold([income(CZK_1, '2026-09-01', '0.1'), income(CZK_2, '2026-09-01', '0.2')])

      expect(formatMoney(row.income)).toBe('0.3000')
    })

    it('can be added and subtracted by the caller without losing digits', () => {
      const [row] = fold([income(CZK_1, '2026-09-01', '19999999999999999.998'), expense(CZK_1, '2026-09-01', '0.0001')])

      expect(row.income.plus('0.0001').toFixed(4)).toBe('19999999999999999.9981')
      expect(row.income.minus(row.expense).toFixed(4)).toBe('19999999999999999.9979')
    })

    it('do not carry over from one call to the next', () => {
      fold([income(CZK_1, '2026-09-01', '100')])

      expect(lines(fold([income(CZK_1, '2026-09-01', '1')]))).toStrictEqual(['CZK|2026-09-01|1.0000|0.0000'])
    })

    it('do not change the groups that were given', () => {
      const given = [income(CZK_1, '2026-09-01', '100'), income(CZK_1, '2026-09-01', '1')]

      fold(given)

      expect(given.map(({ total }) => total.toFixed(4))).toStrictEqual(['100.0000', '1.0000'])
    })
  })

  describe('a broken invariant', () => {
    it('fails for a group of an account that was not read', () => {
      expect(() => fold([income('9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a', '2026-09-01', '1')])).toThrow(
        'A group of transactions belongs to an account that was not read',
      )
    })

    it('fails for a transfer: the query leaves transfers out', () => {
      expect(() => fold([group(CZK_1, '2026-09-01', TransactionType.transfer, '1')])).toThrow(
        'A group of transactions is a transfer',
      )
    })
  })
})
