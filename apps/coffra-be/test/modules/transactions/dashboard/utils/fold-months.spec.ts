import { describe, expect, it } from 'vitest'

import { Prisma } from '../../../../../src/modules/prisma'
import { formatMoney } from '../../../../../src/modules/transactions/common/format-money'
import { Money } from '../../../../../src/modules/transactions/common/money'
import type { MonthSummary } from '../../../../../src/modules/transactions/dashboard/dashboard.types'
import { foldMonths } from '../../../../../src/modules/transactions/dashboard/utils/fold-months'
import type { DayTotal } from '../../../../../src/modules/transactions/totals/totals.types'

const MONTHS = ['2026-08', '2026-09', '2026-10']

/** A row of the totals by day: the amounts are `Money`, as the totals service returns them. */
const day = (currency: string, date: string, income: string, expense: string): DayTotal => ({
  currency,
  date,
  income: new Money(income),
  expense: new Money(expense),
})

/** Adds one side of the rows up from a `Money` value, so the sum is exact whatever the rows are made of. */
const sumOf = (rows: readonly { income: Prisma.Decimal; expense: Prisma.Decimal }[], side: 'income' | 'expense') => {
  let total = new Money(0)

  for (const row of rows) {
    total = total.plus(row[side])
  }

  return total.toFixed(4)
}

/** The series of one currency as `month|income|expense|net`, to compare at a glance. */
const lines = (series: MonthSummary[] | undefined): string[] =>
  (series ?? []).map(
    ({ month, income, expense, net }) => `${month}|${formatMoney(income)}|${formatMoney(expense)}|${formatMoney(net)}`,
  )

describe('foldMonths', () => {
  it('returns no series for no currencies, whatever the days', () => {
    expect(foldMonths([day('CZK', '2026-09-01', '1', '0')], MONTHS, [])).toStrictEqual(new Map())
  })

  it('gives a currency without a day every month with zeros', () => {
    const series = foldMonths([], MONTHS, ['CZK']).get('CZK')

    expect(lines(series)).toStrictEqual([
      '2026-08|0.0000|0.0000|0.0000',
      '2026-09|0.0000|0.0000|0.0000',
      '2026-10|0.0000|0.0000|0.0000',
    ])
  })

  it('fills the months a currency has no day in with zeros, between and around the ones it has', () => {
    const series = foldMonths([day('CZK', '2026-09-15', '100', '40')], MONTHS, ['CZK']).get('CZK')

    expect(lines(series)).toStrictEqual([
      '2026-08|0.0000|0.0000|0.0000',
      '2026-09|100.0000|40.0000|60.0000',
      '2026-10|0.0000|0.0000|0.0000',
    ])
  })

  it('adds the days of a month up, income and expense apart, and writes the net of the month', () => {
    const series = foldMonths(
      [
        day('CZK', '2026-09-01', '100', '0'),
        day('CZK', '2026-09-15', '0', '25.5'),
        day('CZK', '2026-09-30', '200', '300'),
      ],
      MONTHS,
      ['CZK'],
    ).get('CZK')

    expect(lines(series)[1]).toBe('2026-09|300.0000|325.5000|-25.5000')
  })

  it('keeps the months in the order they were named, not the order of the days', () => {
    const series = foldMonths(
      [day('CZK', '2026-10-01', '3', '0'), day('CZK', '2026-08-01', '1', '0'), day('CZK', '2026-09-01', '2', '0')],
      MONTHS,
      ['CZK'],
    ).get('CZK')

    expect(series?.map(({ month }) => month)).toStrictEqual(MONTHS)
    expect(series?.map(({ income }) => formatMoney(income))).toStrictEqual(['1.0000', '2.0000', '3.0000'])
  })

  it('keeps currencies apart: the same day in two currencies is two series', () => {
    const folded = foldMonths([day('CZK', '2026-09-10', '5', '0'), day('EUR', '2026-09-10', '0', '7')], MONTHS, [
      'CZK',
      'EUR',
    ])

    expect(lines(folded.get('CZK'))[1]).toBe('2026-09|5.0000|0.0000|5.0000')
    expect(lines(folded.get('EUR'))[1]).toBe('2026-09|0.0000|7.0000|-7.0000')
  })

  it('makes a series for every currency asked for, in the order they were named', () => {
    const folded = foldMonths([], MONTHS, ['EUR', 'CZK'])

    expect([...folded.keys()]).toStrictEqual(['EUR', 'CZK'])
  })

  it('leaves out the days of a currency nobody asked for', () => {
    const folded = foldMonths([day('CZK', '2026-09-10', '5', '0'), day('USD', '2026-09-10', '9', '0')], MONTHS, ['CZK'])

    expect([...folded.keys()]).toStrictEqual(['CZK'])
    expect(lines(folded.get('CZK'))[1]).toBe('2026-09|5.0000|0.0000|5.0000')
  })

  describe('the edges of a month', () => {
    it('puts the last day of a month in that month and the first day of the next in the next', () => {
      const series = foldMonths(
        [
          day('CZK', '2026-08-31', '1', '0'),
          day('CZK', '2026-09-01', '2', '0'),
          day('CZK', '2026-09-30', '4', '0'),
          day('CZK', '2026-10-01', '8', '0'),
        ],
        MONTHS,
        ['CZK'],
      ).get('CZK')

      expect(series?.map(({ income }) => formatMoney(income))).toStrictEqual(['1.0000', '6.0000', '8.0000'])
    })

    it('puts the leap day in February and the first of March in March', () => {
      const months = ['2024-01', '2024-02', '2024-03']
      const series = foldMonths([day('CZK', '2024-02-29', '1', '0'), day('CZK', '2024-03-01', '2', '0')], months, [
        'CZK',
      ]).get('CZK')

      expect(lines(series)).toStrictEqual([
        '2024-01|0.0000|0.0000|0.0000',
        '2024-02|1.0000|0.0000|1.0000',
        '2024-03|2.0000|0.0000|2.0000',
      ])
    })

    it('puts the 28th of February of a year that is not a leap year in February', () => {
      const months = ['2026-02', '2026-03']
      const series = foldMonths([day('CZK', '2026-02-28', '1', '0'), day('CZK', '2026-03-01', '2', '0')], months, [
        'CZK',
      ]).get('CZK')

      expect(series?.map(({ income }) => formatMoney(income))).toStrictEqual(['1.0000', '2.0000'])
    })

    it('keeps December and the January after it apart', () => {
      const months = ['2025-11', '2025-12', '2026-01']
      const series = foldMonths([day('CZK', '2025-12-31', '1', '0'), day('CZK', '2026-01-01', '2', '0')], months, [
        'CZK',
      ]).get('CZK')

      expect(lines(series)).toStrictEqual([
        '2025-11|0.0000|0.0000|0.0000',
        '2025-12|1.0000|0.0000|1.0000',
        '2026-01|2.0000|0.0000|2.0000',
      ])
    })

    it('counts a day later in the current month, which is still to come', () => {
      const series = foldMonths([day('CZK', '2026-10-31', '0', '40')], MONTHS, ['CZK']).get('CZK')

      expect(lines(series)[2]).toBe('2026-10|0.0000|40.0000|-40.0000')
    })
  })

  it('makes the months add up to the days, income and expense each', () => {
    const days = [
      day('CZK', '2026-08-03', '10.10', '1.01'),
      day('CZK', '2026-08-31', '20.20', '2.02'),
      day('CZK', '2026-09-15', '0', '3.03'),
      day('CZK', '2026-10-01', '40.40', '4.04'),
    ]

    const series = foldMonths(days, MONTHS, ['CZK']).get('CZK') ?? []

    expect(sumOf(series, 'income')).toBe(sumOf(days, 'income'))
    expect(sumOf(series, 'expense')).toBe(sumOf(days, 'expense'))
    expect(sumOf(series, 'income')).toBe('70.7000')
  })

  describe('with amounts that need more than 20 significant digits', () => {
    const FULL = '999999999999999.9999'

    it('adds the days of a month up exactly, the net with them', () => {
      const days = Array.from({ length: 20 }, (_unused, index) =>
        day('CZK', `2026-09-${String(index + 1).padStart(2, '0')}`, FULL, '0'),
      )

      const series = foldMonths([...days, day('CZK', '2026-09-30', '0.0001', '0.0001')], MONTHS, ['CZK']).get('CZK')

      expect(lines(series)[1]).toBe('2026-09|19999999999999999.9981|0.0001|19999999999999999.9980')
    })

    it('is a sum that a plain Prisma.Decimal would round (so the test proves something)', () => {
      let naive = new Prisma.Decimal(0)

      for (let index = 0; index < 20; index += 1) {
        naive = naive.plus(FULL)
      }

      expect(naive.toFixed(4)).not.toBe('19999999999999999.9980')
    })
  })

  describe('a broken invariant', () => {
    it('fails for a day before the first month: the totals service only returns the days it was asked for', () => {
      expect(() => foldMonths([day('CZK', '2026-07-31', '1', '0')], MONTHS, ['CZK'])).toThrow(
        'A day of the totals falls outside the months of the window',
      )
    })

    it('fails for a day after the last month', () => {
      expect(() => foldMonths([day('CZK', '2026-11-01', '1', '0')], MONTHS, ['CZK'])).toThrow(
        'A day of the totals falls outside the months of the window',
      )
    })
  })

  it('does not change the days that were given and does not carry anything over to the next call', () => {
    const given = [day('CZK', '2026-09-01', '100', '0')]

    foldMonths(given, MONTHS, ['CZK'])

    expect(formatMoney(given[0]?.income ?? new Money(0))).toBe('100.0000')
    expect(lines(foldMonths([day('CZK', '2026-09-01', '1', '0')], MONTHS, ['CZK']).get('CZK'))[1]).toBe(
      '2026-09|1.0000|0.0000|1.0000',
    )
  })
})
