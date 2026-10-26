import { describe, expect, it } from 'vitest'

import { Prisma, TransactionType } from '../../../../../src/modules/prisma'
import { formatMoney } from '../../../../../src/modules/transactions/common/format-money'
import type { CategoryTotal, GroupedTotal } from '../../../../../src/modules/transactions/totals/totals.types'
import { foldGroups } from '../../../../../src/modules/transactions/totals/utils/fold-groups'

const CZK_1 = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d'
const CZK_2 = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e'
const EUR_1 = '7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f'
const FOOD = '11111111-1111-4111-8111-111111111111'
const LOWER_FOOD = '22222222-2222-4222-8222-222222222222'
const SALARY = '33333333-3333-4333-8333-333333333333'

const CURRENCIES = new Map([
  [CZK_1, 'CZK'],
  [CZK_2, 'CZK'],
  [EUR_1, 'EUR'],
])
const CATEGORIES = new Map([
  [FOOD, 'Food'],
  [LOWER_FOOD, 'food'],
  [SALARY, 'Salary'],
])

const group = (accountId: string, categoryId: string | null, type: TransactionType, amount: string): GroupedTotal => ({
  accountId,
  categoryId,
  type,
  total: new Prisma.Decimal(amount),
})

const income = (accountId: string, categoryId: string | null, amount: string) =>
  group(accountId, categoryId, TransactionType.income, amount)
const expense = (accountId: string, categoryId: string | null, amount: string) =>
  group(accountId, categoryId, TransactionType.expense, amount)

const fold = (groups: GroupedTotal[]) => foldGroups(groups, CURRENCIES, CATEGORIES)

/** The rows as `currency|category|income|expense`, in the order they came, to compare at a glance. */
const lines = (rows: CategoryTotal[]): string[] =>
  rows.map(
    ({ currency, category, income: inc, expense: exp }) =>
      `${currency}|${category?.name ?? '-'}|${formatMoney(inc)}|${formatMoney(exp)}`,
  )

describe('foldGroups', () => {
  it('returns no rows for no groups', () => {
    expect(fold([])).toStrictEqual([])
  })

  it('makes a row of the currency of the account and the category with its id and name', () => {
    const [row] = fold([income(CZK_1, SALARY, '100')])

    expect(row).toMatchObject({ currency: 'CZK', category: { id: SALARY, name: 'Salary' } })
  })

  it('gives the side without a transaction as zero, income only and expense only alike', () => {
    expect(lines(fold([income(CZK_1, SALARY, '100'), expense(CZK_1, FOOD, '30')]))).toStrictEqual([
      'CZK|Food|0.0000|30.0000',
      'CZK|Salary|100.0000|0.0000',
    ])
  })

  it('puts income and expense of the same category in one row', () => {
    expect(lines(fold([income(CZK_1, FOOD, '10'), expense(CZK_1, FOOD, '4.5')]))).toStrictEqual([
      'CZK|Food|10.0000|4.5000',
    ])
  })

  it('adds the groups of two accounts in the same currency into one row', () => {
    expect(lines(fold([expense(CZK_1, FOOD, '100'), expense(CZK_2, FOOD, '50.5')]))).toStrictEqual([
      'CZK|Food|0.0000|150.5000',
    ])
  })

  it('keeps currencies apart, the same category in two currencies is two rows', () => {
    expect(lines(fold([expense(CZK_1, FOOD, '100'), expense(EUR_1, FOOD, '10')]))).toStrictEqual([
      'CZK|Food|0.0000|100.0000',
      'EUR|Food|0.0000|10.0000',
    ])
  })

  it('makes the transactions without a category a row of their own, with a null category', () => {
    const rows = fold([expense(CZK_1, null, '30'), expense(CZK_1, FOOD, '5')])

    expect(rows.map(({ category }) => category)).toStrictEqual([{ id: FOOD, name: 'Food' }, null])
    expect(lines(rows)).toStrictEqual(['CZK|Food|0.0000|5.0000', 'CZK|-|0.0000|30.0000'])
  })

  it('adds the groups without a category of two accounts, but not across currencies', () => {
    expect(
      lines(fold([expense(CZK_1, null, '1'), expense(CZK_2, null, '2'), expense(EUR_1, null, '4')])),
    ).toStrictEqual(['CZK|-|0.0000|3.0000', 'EUR|-|0.0000|4.0000'])
  })

  it('tells two categories apart whose names differ only in case', () => {
    expect(lines(fold([expense(CZK_1, LOWER_FOOD, '2'), expense(CZK_1, FOOD, '1')]))).toStrictEqual([
      'CZK|Food|0.0000|1.0000',
      'CZK|food|0.0000|2.0000',
    ])
  })

  describe('the order of the rows', () => {
    const groups = [
      expense(EUR_1, FOOD, '1'),
      expense(CZK_1, null, '2'),
      expense(CZK_1, LOWER_FOOD, '3'),
      income(CZK_1, SALARY, '4'),
      expense(CZK_1, FOOD, '5'),
    ]

    it('is the currency, then the name of the category by code units, the rows without a category last', () => {
      // `Food`, `Salary` and `food`: capitals before lower case, which `localeCompare` would not do.
      expect(lines(fold(groups))).toStrictEqual([
        'CZK|Food|0.0000|5.0000',
        'CZK|Salary|4.0000|0.0000',
        'CZK|food|0.0000|3.0000',
        'CZK|-|0.0000|2.0000',
        'EUR|Food|0.0000|1.0000',
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
      const groups = [...accounts.keys()].map((accountId) => expense(accountId, FOOD, FULL))

      const [row] = foldGroups(groups, accounts, CATEGORIES)

      expect(formatMoney(row.expense)).toBe('19999999999999999.9980')
    })

    it('are exact where a floating point number is not', () => {
      const [row] = fold([income(CZK_1, SALARY, '0.1'), income(CZK_2, SALARY, '0.2')])

      expect(formatMoney(row.income)).toBe('0.3000')
    })

    it('can be added and subtracted by the caller without losing digits', () => {
      const [row] = fold([income(CZK_1, SALARY, '19999999999999999.998'), expense(CZK_1, SALARY, '0.0001')])

      expect(row.income.plus('0.0001').toFixed(4)).toBe('19999999999999999.9981')
      expect(row.income.minus(row.expense).toFixed(4)).toBe('19999999999999999.9979')
    })

    it('do not carry over from one call to the next', () => {
      fold([income(CZK_1, SALARY, '100')])

      expect(lines(fold([income(CZK_1, SALARY, '1')]))).toStrictEqual(['CZK|Salary|1.0000|0.0000'])
    })

    it('do not change the groups that were given', () => {
      const given = [income(CZK_1, SALARY, '100'), income(CZK_1, SALARY, '1')]

      fold(given)

      expect(given.map(({ total }) => total.toFixed(4))).toStrictEqual(['100.0000', '1.0000'])
    })
  })

  describe('a broken invariant', () => {
    it('fails for a group of an account that was not read', () => {
      expect(() => fold([income('9d8c7b6a-5f4e-4d3c-8b2a-1f0e9d8c7b6a', FOOD, '1')])).toThrow(
        'A group of transactions belongs to an account that was not read',
      )
    })

    it('fails for a group of a category that was not read, and does not name it', () => {
      const foreign = '44444444-4444-4444-8444-444444444444'

      expect(() => fold([income(CZK_1, foreign, '1')])).toThrow(
        'A group of transactions belongs to a category that was not read',
      )
      expect(() => fold([income(CZK_1, foreign, '1')])).not.toThrow(foreign)
    })

    it('fails for a transfer: the query leaves transfers out', () => {
      expect(() => fold([group(CZK_1, null, TransactionType.transfer, '1')])).toThrow(
        'A group of transactions is a transfer',
      )
    })
  })
})
