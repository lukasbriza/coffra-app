import { describe, expect, it } from 'vitest'

import { Money } from '../../../../src/modules/transactions/common/money'
import { toDashboardView } from '../../../../src/modules/transactions/dashboard/dashboard.mapper'
import type { CurrencySummary } from '../../../../src/modules/transactions/dashboard/dashboard.types'

const FOOD = '11111111-1111-4111-8111-111111111111'
const WINDOW = { from: '2026-08-01', to: '2026-10-31' }

const summary: CurrencySummary = {
  currency: 'CZK',
  income: new Money('5000'),
  expense: new Money('150.25'),
  net: new Money('4849.75'),
  categories: [
    { categoryId: FOOD, name: 'Food', income: new Money(0), expense: new Money('150.25'), net: new Money('-150.25') },
    { categoryId: null, name: null, income: new Money('5000'), expense: new Money(0), net: new Money('5000') },
  ],
  trend: [
    { month: '2026-08', income: new Money('5000'), expense: new Money(0), net: new Money('5000') },
    { month: '2026-09', income: new Money(0), expense: new Money(0), net: new Money(0) },
    { month: '2026-10', income: new Money(0), expense: new Money('150.25'), net: new Money('-150.25') },
  ],
}

describe('toDashboardView', () => {
  it('writes every amount as a decimal string with four decimal places', () => {
    expect(toDashboardView('3m', WINDOW, [summary])).toStrictEqual({
      period: '3m',
      from: '2026-08-01',
      to: '2026-10-31',
      currencies: [
        {
          currency: 'CZK',
          income: '5000.0000',
          expense: '150.2500',
          net: '4849.7500',
          categories: [
            { categoryId: FOOD, name: 'Food', income: '0.0000', expense: '150.2500', net: '-150.2500' },
            { categoryId: null, name: null, income: '5000.0000', expense: '0.0000', net: '5000.0000' },
          ],
          trend: [
            { month: '2026-08', income: '5000.0000', expense: '0.0000', net: '5000.0000' },
            { month: '2026-09', income: '0.0000', expense: '0.0000', net: '0.0000' },
            { month: '2026-10', income: '0.0000', expense: '150.2500', net: '-150.2500' },
          ],
        },
      ],
    })
  })

  it('keeps the months in the order they were given and writes each as it was named', () => {
    const view = toDashboardView('3m', WINDOW, [summary])

    expect(view.currencies[0]?.trend.map(({ month }) => month)).toStrictEqual(['2026-08', '2026-09', '2026-10'])
  })

  it('writes a currency without a month as an empty trend', () => {
    expect(toDashboardView('3m', WINDOW, [{ ...summary, trend: [] }]).currencies[0]?.trend).toStrictEqual([])
  })

  it('writes the amounts of a month with four decimal places, a tiny one without an exponent', () => {
    const tiny: CurrencySummary = {
      ...summary,
      trend: [{ month: '2026-10', income: new Money('0.0000001'), expense: new Money(0), net: new Money('0.0000001') }],
    }

    expect(toDashboardView('3m', WINDOW, [tiny]).currencies[0]?.trend[0]).toStrictEqual({
      month: '2026-10',
      income: '0.0000',
      expense: '0.0000',
      net: '0.0000',
    })
  })

  it('writes the amount of a month of more than 20 digits in full', () => {
    const big: CurrencySummary = {
      ...summary,
      trend: [
        {
          month: '2026-10',
          income: new Money('19999999999999999.9981'),
          expense: new Money('0.0001'),
          net: new Money('19999999999999999.9980'),
        },
      ],
    }

    expect(toDashboardView('3m', WINDOW, [big]).currencies[0]?.trend[0]).toStrictEqual({
      month: '2026-10',
      income: '19999999999999999.9981',
      expense: '0.0001',
      net: '19999999999999999.9980',
    })
  })

  it('carries the period and the window as they are', () => {
    expect(toDashboardView('1y', { from: '2025-11-01', to: '2026-10-31' }, [])).toStrictEqual({
      period: '1y',
      from: '2025-11-01',
      to: '2026-10-31',
      currencies: [],
    })
  })

  it('writes a currency in the order it was given and keeps the order of its categories', () => {
    const eur: CurrencySummary = { ...summary, currency: 'EUR', categories: summary.categories.toReversed() }
    const view = toDashboardView('6m', WINDOW, [summary, eur])

    expect(view.currencies.map(({ currency }) => currency)).toStrictEqual(['CZK', 'EUR'])
    expect(view.currencies[1]?.categories.map(({ categoryId }) => categoryId)).toStrictEqual([null, FOOD])
  })

  it('never writes an exponent, even for a tiny amount', () => {
    const tiny: CurrencySummary = { ...summary, income: new Money('0.0000001'), categories: [] }

    expect(toDashboardView('3m', WINDOW, [tiny]).currencies[0]?.income).toBe('0.0000')
  })

  it('writes an amount of more than 20 digits in full', () => {
    const big: CurrencySummary = { ...summary, income: new Money('19999999999999999.9981'), categories: [] }

    expect(toDashboardView('3m', WINDOW, [big]).currencies[0]?.income).toBe('19999999999999999.9981')
  })
})
