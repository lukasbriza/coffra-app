import { describe, expect, it } from 'vitest'

import { Prisma } from '../../../../../src/modules/prisma'
import { formatMoney } from '../../../../../src/modules/transactions/common/format-money'
import { Money } from '../../../../../src/modules/transactions/common/money'
import type { CurrencySummary } from '../../../../../src/modules/transactions/dashboard/dashboard.types'
import { summarizeTotals } from '../../../../../src/modules/transactions/dashboard/utils/summarize-totals'
import type { CategoryTotal } from '../../../../../src/modules/transactions/totals/totals.types'

const FOOD = '11111111-1111-4111-8111-111111111111'
const RENT = '22222222-2222-4222-8222-222222222222'
const SALARY = '33333333-3333-4333-8333-333333333333'

/** A row of the totals service: the amounts are `Money`, as the service returns them. */
const row = (
  currency: string,
  category: [id: string, name: string] | null,
  income: string,
  expense: string,
): CategoryTotal => ({
  currency,
  category: category === null ? null : { id: category[0], name: category[1] },
  income: new Money(income),
  expense: new Money(expense),
})

/** One summary as `CUR|income|expense|net` followed by its categories as `name|income|expense|net`, to read at a glance. */
const lines = (summaries: CurrencySummary[]): string[][] =>
  summaries.map(({ currency, income, expense, net, categories }) => [
    `${currency}|${formatMoney(income)}|${formatMoney(expense)}|${formatMoney(net)}`,
    ...categories.map(
      (category) =>
        `${category.name ?? '-'}|${formatMoney(category.income)}|${formatMoney(category.expense)}|${formatMoney(category.net)}`,
    ),
  ])

describe('summarizeTotals', () => {
  it('returns no summaries for no rows', () => {
    expect(summarizeTotals([])).toStrictEqual([])
  })

  it('makes one summary of the rows of one currency, with the net of each side', () => {
    const summaries = summarizeTotals([
      row('CZK', [SALARY, 'Salary'], '5000', '0'),
      row('CZK', [FOOD, 'Food'], '0', '150.25'),
    ])

    expect(lines(summaries)).toStrictEqual([
      ['CZK|5000.0000|150.2500|4849.7500', 'Salary|5000.0000|0.0000|5000.0000', 'Food|0.0000|150.2500|-150.2500'],
    ])
  })

  it('shows a negative net when more was spent than earned', () => {
    const [summary] = summarizeTotals([row('CZK', [FOOD, 'Food'], '10', '300')])

    expect(formatMoney(summary.net)).toBe('-290.0000')
  })

  it('keeps the currencies apart, in the order the rows came in', () => {
    const summaries = summarizeTotals([
      row('CZK', [FOOD, 'Food'], '0', '150'),
      row('EUR', [FOOD, 'Food'], '0', '10'),
      row('USD', [SALARY, 'Salary'], '7', '0'),
    ])

    expect(summaries.map(({ currency }) => currency)).toStrictEqual(['CZK', 'EUR', 'USD'])
    expect(lines(summaries)).toStrictEqual([
      ['CZK|0.0000|150.0000|-150.0000', 'Food|0.0000|150.0000|-150.0000'],
      ['EUR|0.0000|10.0000|-10.0000', 'Food|0.0000|10.0000|-10.0000'],
      ['USD|7.0000|0.0000|7.0000', 'Salary|7.0000|0.0000|7.0000'],
    ])
  })

  it('gathers the rows of a currency into one summary when other currencies come between them', () => {
    const summaries = summarizeTotals([
      row('CZK', [FOOD, 'Food'], '0', '1'),
      row('EUR', [FOOD, 'Food'], '0', '2'),
      row('CZK', [RENT, 'Rent'], '0', '4'),
    ])

    expect(summaries.map(({ currency }) => currency)).toStrictEqual(['CZK', 'EUR'])
    expect(summaries[0].categories.map(({ name }) => name)).toStrictEqual(['Rent', 'Food'])
  })

  it('makes the total of a currency the sum of its categories', () => {
    const [summary] = summarizeTotals([
      row('CZK', [SALARY, 'Salary'], '1000.10', '0'),
      row('CZK', [FOOD, 'Food'], '20.20', '300.30'),
      row('CZK', null, '0', '4.40'),
    ])

    expect(formatMoney(summary.income)).toBe('1020.3000')
    expect(formatMoney(summary.expense)).toBe('304.7000')
    expect(formatMoney(summary.net)).toBe('715.6000')
  })

  describe('the order of the categories', () => {
    it('puts the one with the largest income plus expense first', () => {
      const [summary] = summarizeTotals([
        row('CZK', [FOOD, 'Food'], '0', '100'),
        row('CZK', [SALARY, 'Salary'], '500', '0'),
        row('CZK', [RENT, 'Rent'], '0', '250'),
      ])

      expect(summary.categories.map(({ name }) => name)).toStrictEqual(['Salary', 'Rent', 'Food'])
    })

    it('sizes a category by both sides: a category with 60 in and 60 out is larger than one with 100 in', () => {
      const [summary] = summarizeTotals([
        row('CZK', [SALARY, 'Salary'], '100', '0'),
        row('CZK', [FOOD, 'Food'], '60', '60'),
      ])

      expect(summary.categories.map(({ name }) => name)).toStrictEqual(['Food', 'Salary'])
    })

    it('puts the transactions without a category last, even when they are the largest', () => {
      const [summary] = summarizeTotals([
        row('CZK', [FOOD, 'Food'], '0', '1'),
        row('CZK', null, '0', '1000'),
        row('CZK', [RENT, 'Rent'], '0', '2'),
      ])

      expect(summary.categories.map(({ categoryId }) => categoryId)).toStrictEqual([RENT, FOOD, null])
    })

    it('keeps the order of the rows for categories of the same size', () => {
      const [summary] = summarizeTotals([
        row('CZK', [RENT, 'Rent'], '0', '10'),
        row('CZK', [FOOD, 'Food'], '0', '10'),
        row('CZK', [SALARY, 'Salary'], '10', '0'),
      ])

      expect(summary.categories.map(({ name }) => name)).toStrictEqual(['Rent', 'Food', 'Salary'])
    })

    it('does not touch the order of the rows it was given', () => {
      const rows = [row('CZK', [FOOD, 'Food'], '0', '1'), row('CZK', [RENT, 'Rent'], '0', '2')]

      summarizeTotals(rows)

      expect(rows.map(({ category }) => category?.name)).toStrictEqual(['Food', 'Rent'])
    })
  })

  it('leaves the id and the name of the transactions without a category null, and only theirs', () => {
    const [summary] = summarizeTotals([row('CZK', [FOOD, 'Food'], '0', '1'), row('CZK', null, '0', '2')])

    expect(summary.categories.map(({ categoryId, name }) => [categoryId, name])).toStrictEqual([
      [FOOD, 'Food'],
      [null, null],
    ])
  })

  describe('with amounts that need more than 20 significant digits', () => {
    const FULL = '999999999999999.9999'

    /** Twenty categories with a full amount of income each, and one with a tiny income and expense. */
    const rows = (): CategoryTotal[] => [
      ...Array.from({ length: 20 }, (_unused, index) =>
        row(
          'CZK',
          [`00000000-0000-4000-8000-0000000000${String(index).padStart(2, '0')}`, `Category ${index}`],
          FULL,
          '0',
        ),
      ),
      row('CZK', [FOOD, 'Tiny'], '0.0001', '0.0002'),
    ]

    it('adds the income up exactly, the expense and the net with it', () => {
      const [summary] = summarizeTotals(rows())

      // 20 × 999999999999999.9999 + 0.0001: the partial sums need 21 digits from the eleventh amount on.
      expect(formatMoney(summary.income)).toBe('19999999999999999.9981')
      expect(formatMoney(summary.expense)).toBe('0.0002')
      expect(formatMoney(summary.net)).toBe('19999999999999999.9979')
    })

    it('is a sum that a plain Prisma.Decimal would round (so the test proves something)', () => {
      let naive = new Prisma.Decimal(0)

      for (const { income } of rows()) {
        naive = naive.plus(income)
      }

      expect(naive.toFixed(4)).not.toBe('19999999999999999.9981')
    })

    it('keeps the net of a category exact', () => {
      const [summary] = summarizeTotals([row('CZK', [FOOD, 'Food'], '19999999999999999.9981', '0.0001')])

      expect(formatMoney(summary.categories[0].net)).toBe('19999999999999999.9980')
    })
  })
})
