import { describe, expect, it } from 'vitest'

import { Money } from '../../../../../src/modules/transactions/common/money'
import type { Period } from '../../../../../src/modules/transactions/dashboard/dashboard.types'
import type { CategoryTotal } from '../../../../../src/modules/transactions/totals/totals.types'

import { day, FOOD, OWNER, RENT, row, SALARY, useDashboardService, zeroTrend } from './setup'

/** Adds one side of every month of a trend up from a `Money` value, as a client that wants the total would. */
const sumOf = (trend: readonly { income: string; expense: string }[], side: 'income' | 'expense'): string => {
  let total = new Money(0)

  for (const month of trend) {
    total = total.plus(month[side])
  }

  return total.toFixed(4)
}

describe('DashboardService.get', () => {
  const { service, categoryTotals, dailyTotals } = useDashboardService()

  describe('what it asks of the totals service', () => {
    it.each<[period: Period, from: string]>([
      ['3m', '2026-08-01'],
      ['6m', '2026-05-01'],
      ['1y', '2025-11-01'],
    ])('asks for the window of the period %s: %s .. the end of the current month', async (period, from) => {
      await service.get(OWNER, { period })

      expect(categoryTotals).toHaveBeenCalledExactlyOnceWith(OWNER, { from, to: '2026-10-31' })
      expect(dailyTotals).toHaveBeenCalledExactlyOnceWith(OWNER, { from, to: '2026-10-31' })
    })

    it('hands the owner over as it is and asks once for each figure', async () => {
      await service.get(OWNER, {})

      expect(categoryTotals).toHaveBeenCalledTimes(1)
      expect(categoryTotals.mock.calls[0]?.[0]).toBe(OWNER)
      expect(dailyTotals).toHaveBeenCalledTimes(1)
      expect(dailyTotals.mock.calls[0]?.[0]).toBe(OWNER)
    })

    it('asks for the same days in both, whatever the period', async () => {
      await service.get(OWNER, { period: '1y' })

      expect(dailyTotals.mock.calls[0]?.[1]).toStrictEqual(categoryTotals.mock.calls[0]?.[1])
    })

    it('uses the period 3m when the query names none', async () => {
      await service.get(OWNER, {})

      expect(categoryTotals).toHaveBeenCalledExactlyOnceWith(OWNER, { from: '2026-08-01', to: '2026-10-31' })
      expect(dailyTotals).toHaveBeenCalledExactlyOnceWith(OWNER, { from: '2026-08-01', to: '2026-10-31' })
    })

    it('asks for both at once, not one after the other', async () => {
      const categories = Promise.withResolvers<CategoryTotal[]>()
      categoryTotals.mockReturnValue(categories.promise)

      const answer = service.get(OWNER, {})

      // The categories are still being read, and the days have already been asked for.
      expect(dailyTotals).toHaveBeenCalledTimes(1)

      categories.resolve([])
      await answer
    })
  })

  describe('the answer', () => {
    it('names the period that was used, the default one included', async () => {
      const byDefault = await service.get(OWNER, {})
      const sixMonths = await service.get(OWNER, { period: '6m' })
      const year = await service.get(OWNER, { period: '1y' })

      expect([byDefault.period, sixMonths.period, year.period]).toStrictEqual(['3m', '6m', '1y'])
    })

    it('carries the window in `from` and `to`', async () => {
      const view = await service.get(OWNER, { period: '1y' })

      expect([view.from, view.to]).toStrictEqual(['2025-11-01', '2026-10-31'])
    })

    it('has no currencies when nothing falls in the window', async () => {
      await expect(service.get(OWNER, {})).resolves.toStrictEqual({
        period: '3m',
        from: '2026-08-01',
        to: '2026-10-31',
        currencies: [],
      })
    })

    it('lays out the totals per currency with their categories, the largest first and no category last', async () => {
      categoryTotals.mockResolvedValue([
        row('CZK', [FOOD, 'Food'], '0', '12000'),
        row('CZK', [RENT, 'Rent'], '0', '15000.5'),
        row('CZK', [SALARY, 'Salary'], '52000', '0'),
        row('CZK', null, '0', '300'),
        row('EUR', [FOOD, 'Food'], '0', '10'),
      ])

      await expect(service.get(OWNER, { period: '3m' })).resolves.toStrictEqual({
        period: '3m',
        from: '2026-08-01',
        to: '2026-10-31',
        currencies: [
          {
            currency: 'CZK',
            income: '52000.0000',
            expense: '27300.5000',
            net: '24699.5000',
            categories: [
              { categoryId: SALARY, name: 'Salary', income: '52000.0000', expense: '0.0000', net: '52000.0000' },
              { categoryId: RENT, name: 'Rent', income: '0.0000', expense: '15000.5000', net: '-15000.5000' },
              { categoryId: FOOD, name: 'Food', income: '0.0000', expense: '12000.0000', net: '-12000.0000' },
              { categoryId: null, name: null, income: '0.0000', expense: '300.0000', net: '-300.0000' },
            ],
            trend: zeroTrend(),
          },
          {
            currency: 'EUR',
            income: '0.0000',
            expense: '10.0000',
            net: '-10.0000',
            categories: [{ categoryId: FOOD, name: 'Food', income: '0.0000', expense: '10.0000', net: '-10.0000' }],
            trend: zeroTrend(),
          },
        ],
      })
    })

    it('keeps the currencies in the order the totals service gave them', async () => {
      categoryTotals.mockResolvedValue([
        row('CZK', null, '1', '0'),
        row('EUR', null, '1', '0'),
        row('USD', null, '1', '0'),
      ])

      const view = await service.get(OWNER, {})

      expect(view.currencies.map(({ currency }) => currency)).toStrictEqual(['CZK', 'EUR', 'USD'])
    })

    it('adds the categories of a currency up to the total of the currency', async () => {
      categoryTotals.mockResolvedValue([
        row('CZK', [FOOD, 'Food'], '10.10', '20.20'),
        row('CZK', [RENT, 'Rent'], '30.30', '40.40'),
        row('CZK', null, '50.50', '60.60'),
      ])

      const { currencies } = await service.get(OWNER, {})

      expect(currencies[0]).toMatchObject({ income: '90.9000', expense: '121.2000', net: '-30.3000' })
    })

    describe('with amounts that need more than 20 significant digits across many categories', () => {
      const FULL = '999999999999999.9999'

      it('adds them up exactly', async () => {
        categoryTotals.mockResolvedValue([
          ...Array.from({ length: 20 }, (_unused, index) =>
            row(
              'CZK',
              [`00000000-0000-4000-8000-0000000000${String(index).padStart(2, '0')}`, `Category ${index}`],
              FULL,
              FULL,
            ),
          ),
          row('CZK', [FOOD, 'Tiny'], '0.0001', '0'),
        ])

        const { currencies } = await service.get(OWNER, {})
        const [currency] = currencies

        expect(currency).toMatchObject({
          income: '19999999999999999.9981',
          expense: '19999999999999999.9980',
          net: '0.0001',
        })
        expect(currency.categories.at(-1)).toMatchObject({ name: 'Tiny', net: '0.0001' })
      })
    })
  })

  describe('the trend', () => {
    it.each<[period: Period, months: number, first: string]>([
      ['3m', 3, '2026-08'],
      ['6m', 6, '2026-05'],
      ['1y', 12, '2025-11'],
    ])('has every month of the period %s, the oldest first, up to the current one', async (period, months, first) => {
      categoryTotals.mockResolvedValue([row('CZK', null, '1', '0')])

      const { currencies } = await service.get(OWNER, { period })
      const trend = currencies[0]?.trend ?? []

      expect(trend).toHaveLength(months)
      expect(trend[0]?.month).toBe(first)
      expect(trend.at(-1)?.month).toBe('2026-10')
      expect(trend.map(({ month }) => month)).toStrictEqual(trend.map(({ month }) => month).toSorted())
    })

    it('crosses the turn of the year', async () => {
      categoryTotals.mockResolvedValue([row('CZK', null, '1', '0')])

      const { currencies } = await service.get(OWNER, { period: '1y' })

      expect(currencies[0]?.trend.map(({ month }) => month)).toStrictEqual([
        '2025-11',
        '2025-12',
        '2026-01',
        '2026-02',
        '2026-03',
        '2026-04',
        '2026-05',
        '2026-06',
        '2026-07',
        '2026-08',
        '2026-09',
        '2026-10',
      ])
    })

    it('adds the days of a month up, with the net of the month', async () => {
      categoryTotals.mockResolvedValue([row('CZK', null, '300', '125.5')])
      dailyTotals.mockResolvedValue([
        day('CZK', '2026-09-01', '100', '0'),
        day('CZK', '2026-09-15', '0', '25.5'),
        day('CZK', '2026-09-30', '200', '100'),
      ])

      const { currencies } = await service.get(OWNER, {})

      expect(currencies[0]?.trend).toStrictEqual([
        { month: '2026-08', income: '0.0000', expense: '0.0000', net: '0.0000' },
        { month: '2026-09', income: '300.0000', expense: '125.5000', net: '174.5000' },
        { month: '2026-10', income: '0.0000', expense: '0.0000', net: '0.0000' },
      ])
    })

    it('puts the last day of a month in that month and the first day of the next in the next', async () => {
      categoryTotals.mockResolvedValue([row('CZK', null, '3', '0')])
      dailyTotals.mockResolvedValue([
        day('CZK', '2026-08-31', '1', '0'),
        day('CZK', '2026-09-01', '2', '0'),
        day('CZK', '2026-09-30', '4', '0'),
        day('CZK', '2026-10-01', '8', '0'),
      ])

      const { currencies } = await service.get(OWNER, {})

      expect(currencies[0]?.trend.map(({ month, income }) => `${month}:${income}`)).toStrictEqual([
        '2026-08:1.0000',
        '2026-09:6.0000',
        '2026-10:8.0000',
      ])
    })

    it('counts a planned transaction later in the current month', async () => {
      categoryTotals.mockResolvedValue([row('CZK', null, '0', '40')])
      // The clock stands on 26 October: the 31st is still to come.
      dailyTotals.mockResolvedValue([day('CZK', '2026-10-31', '0', '40')])

      const { currencies } = await service.get(OWNER, {})

      expect(currencies[0]?.trend.at(-1)).toStrictEqual({
        month: '2026-10',
        income: '0.0000',
        expense: '40.0000',
        net: '-40.0000',
      })
    })

    it('keeps the currencies apart: the same day in two currencies is two months', async () => {
      categoryTotals.mockResolvedValue([row('CZK', null, '5', '0'), row('EUR', null, '0', '7')])
      dailyTotals.mockResolvedValue([day('CZK', '2026-09-10', '5', '0'), day('EUR', '2026-09-10', '0', '7')])

      const { currencies } = await service.get(OWNER, {})

      expect(currencies.map(({ currency, trend }) => [currency, trend[1]?.income, trend[1]?.expense])).toStrictEqual([
        ['CZK', '5.0000', '0.0000'],
        ['EUR', '0.0000', '7.0000'],
      ])
    })

    it('gives a currency without a day zeros in every month', async () => {
      categoryTotals.mockResolvedValue([row('CZK', null, '5', '0')])

      const { currencies } = await service.get(OWNER, {})

      expect(currencies[0]?.trend).toStrictEqual(zeroTrend())
    })

    it('leaves out a currency that only the days know: the currencies are those of the categories', async () => {
      // A transaction in a new currency written between the two reads is in one of them only.
      categoryTotals.mockResolvedValue([row('CZK', null, '5', '0')])
      dailyTotals.mockResolvedValue([day('CZK', '2026-09-10', '5', '0'), day('USD', '2026-09-10', '9', '0')])

      const { currencies } = await service.get(OWNER, {})

      expect(currencies.map(({ currency }) => currency)).toStrictEqual(['CZK'])
    })

    it('adds up to the totals of the currency, every month with the income and the expense of its days', async () => {
      categoryTotals.mockResolvedValue([
        row('CZK', [SALARY, 'Salary'], '52000.10', '0'),
        row('CZK', [FOOD, 'Food'], '0', '12000.20'),
        row('CZK', null, '0', '300.30'),
      ])
      dailyTotals.mockResolvedValue([
        day('CZK', '2026-08-25', '26000.05', '4000.10'),
        day('CZK', '2026-10-01', '26000.05', '8000.10'),
        day('CZK', '2026-10-02', '0', '300.30'),
      ])

      const { currencies } = await service.get(OWNER, {})
      const [currency] = currencies

      expect(sumOf(currency.trend, 'income')).toBe(currency.income)
      expect(sumOf(currency.trend, 'expense')).toBe(currency.expense)
      expect(sumOf(currency.trend, 'income')).toBe('52000.1000')
    })

    describe('with amounts that need more than 20 significant digits in one month', () => {
      const FULL = '999999999999999.9999'

      it('adds them up exactly, the expense and the net of the month with them', async () => {
        categoryTotals.mockResolvedValue([row('CZK', null, '19999999999999999.9981', '0.0001')])
        dailyTotals.mockResolvedValue([
          // Twenty days of September with a full amount each, and a tiny income and expense on the last day.
          ...Array.from({ length: 20 }, (_unused, index) =>
            day('CZK', `2026-09-${String(index + 1).padStart(2, '0')}`, FULL, '0'),
          ),
          day('CZK', '2026-09-30', '0.0001', '0.0001'),
        ])

        const { currencies } = await service.get(OWNER, {})
        const [currency] = currencies

        expect(currency.trend[1]).toStrictEqual({
          month: '2026-09',
          income: '19999999999999999.9981',
          expense: '0.0001',
          net: '19999999999999999.9980',
        })
      })
    })

    it('fails on a day outside the window instead of dropping it', async () => {
      categoryTotals.mockResolvedValue([row('CZK', null, '1', '0')])
      dailyTotals.mockResolvedValue([day('CZK', '2026-07-31', '1', '0')])

      await expect(service.get(OWNER, {})).rejects.toThrow('A day of the totals falls outside the months of the window')
    })
  })

  it('passes on a failure of the totals service instead of answering with partial numbers', async () => {
    categoryTotals.mockRejectedValue(new Error('the database is down'))

    await expect(service.get(OWNER, {})).rejects.toThrow('the database is down')
  })

  it('passes on a failure of the totals by day instead of answering without the trend', async () => {
    categoryTotals.mockResolvedValue([row('CZK', null, '1', '0')])
    dailyTotals.mockRejectedValue(new Error('the database is down'))

    await expect(service.get(OWNER, {})).rejects.toThrow('the database is down')
  })
})
