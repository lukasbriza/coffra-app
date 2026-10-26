import { describe, expect, it } from 'vitest'

import type { Period } from '../../../../../src/modules/transactions/dashboard/dashboard.types'

import { FOOD, OWNER, RENT, row, SALARY, useDashboardService } from './setup'

describe('DashboardService.get', () => {
  const { service, categoryTotals } = useDashboardService()

  describe('what it asks of the totals service', () => {
    it.each<[period: Period, from: string]>([
      ['3m', '2026-08-01'],
      ['6m', '2026-05-01'],
      ['1y', '2025-11-01'],
    ])('asks for the window of the period %s: %s .. the end of the current month', async (period, from) => {
      await service.get(OWNER, { period })

      expect(categoryTotals).toHaveBeenCalledExactlyOnceWith(OWNER, { from, to: '2026-10-31' })
    })

    it('hands the owner over as it is and asks once', async () => {
      await service.get(OWNER, {})

      expect(categoryTotals).toHaveBeenCalledTimes(1)
      expect(categoryTotals.mock.calls[0]?.[0]).toBe(OWNER)
    })

    it('uses the period 3m when the query names none', async () => {
      await service.get(OWNER, {})

      expect(categoryTotals).toHaveBeenCalledExactlyOnceWith(OWNER, { from: '2026-08-01', to: '2026-10-31' })
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
          },
          {
            currency: 'EUR',
            income: '0.0000',
            expense: '10.0000',
            net: '-10.0000',
            categories: [{ categoryId: FOOD, name: 'Food', income: '0.0000', expense: '10.0000', net: '-10.0000' }],
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

  it('passes on a failure of the totals service instead of answering with partial numbers', async () => {
    categoryTotals.mockRejectedValue(new Error('the database is down'))

    await expect(service.get(OWNER, {})).rejects.toThrow('the database is down')
  })
})
