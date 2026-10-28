import { describe, expect, it } from 'vitest'

import { stopClock } from '../support/clock'
import { currencyOf, getDashboard } from '../support/dashboard-checks'
import { clearTransactions, writeRows } from '../support/ledger'
import { useIntegrationApp } from '../support/use-integration-app'

const ZERO = '0.0000'

// The edges of the window and of the months, through the real `DATE` column and the real `GROUP BY`. The days are
// written out by hand, worked out from the calendar and not from the code: a window that is one day too long or too
// short, or a day that slips into the next month, fails here.
describe('the edges of the window and of the months', () => {
  const { as, world, prisma, issueToken } = useIntegrationApp()

  // [clock, period, the day before the window, its first day, its last day, the day after it]
  describe.each([
    ['2026-02-15T12:00:00.000Z', '3m', '2025-11-30', '2025-12-01', '2026-02-28', '2026-03-01'],
    ['2028-02-29T12:00:00.000Z', '3m', '2027-11-30', '2027-12-01', '2028-02-29', '2028-03-01'],
    ['2027-02-28T23:59:59.999Z', '3m', '2026-11-30', '2026-12-01', '2027-02-28', '2027-03-01'],
    ['2027-03-01T00:00:00.000Z', '3m', '2026-12-31', '2027-01-01', '2027-03-31', '2027-04-01'],
    ['2026-12-31T23:59:59.999Z', '1y', '2025-12-31', '2026-01-01', '2026-12-31', '2027-01-01'],
    ['2027-01-01T00:00:00.000Z', '1y', '2026-01-31', '2026-02-01', '2027-01-31', '2027-02-01'],
    ['2026-01-15T10:00:00.000Z', '6m', '2025-07-31', '2025-08-01', '2026-01-31', '2026-02-01'],
    ['2024-02-29T00:00:00.000Z', '1y', '2023-02-28', '2023-03-01', '2024-02-29', '2024-03-01'],
    ['2026-08-31T23:59:59.000Z', '6m', '2026-02-28', '2026-03-01', '2026-08-31', '2026-09-01'],
    ['2026-09-01T00:00:00.000Z', '6m', '2026-03-31', '2026-04-01', '2026-09-30', '2026-10-01'],
  ] as const)('on %s with the period %s', (instant, period, dayBefore, from, to, dayAfter) => {
    it(`counts ${from} .. ${to} and not the days next to it`, async () => {
      const { a } = await stopClock(instant, world(), issueToken)
      await clearTransactions(prisma())
      // Amounts 1, 2, 4, 8 on the four days: the sum says which of them were counted.
      await writeRows(
        prisma(),
        [dayBefore, from, to, dayAfter].flatMap((date, index) => [
          { accountId: a.accounts.main, type: 'income' as const, amount: String(2 ** index), date },
          { accountId: a.accounts.main, type: 'expense' as const, amount: String(10 * 2 ** index), date },
        ]),
      )

      const body = await getDashboard(as(a), period)
      const { trend, income, expense, net } = currencyOf(body, 'CZK')

      expect([body.from, body.to]).toStrictEqual([from, to])
      expect([income, expense, net]).toStrictEqual(['6.0000', '60.0000', '-54.0000'])
      // The first and the last month of the series hold one counted day each, the months between hold nothing.
      expect(trend[0]).toStrictEqual({ month: from.slice(0, 7), income: '2.0000', expense: '20.0000', net: '-18.0000' })
      expect(trend.at(-1)).toStrictEqual({
        month: to.slice(0, 7),
        income: '4.0000',
        expense: '40.0000',
        net: '-36.0000',
      })
      expect(trend.slice(1, -1).map(({ income: monthIncome }) => monthIncome)).toStrictEqual(
        trend.slice(1, -1).map(() => ZERO),
      )
    })
  })

  // [what the case shows, the clock, the period, the days with their amounts, the months with income, the months of the series]
  it.each([
    [
      'the last day of August and the first of September',
      '2026-10-15T12:00:00.000Z',
      '6m',
      [
        ['2026-08-31', '1'],
        ['2026-09-01', '2'],
      ],
      { '2026-08': '1.0000', '2026-09': '2.0000' },
      ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'],
    ],
    [
      'the last day of February 2027 (not a leap year) and the first of March',
      '2027-04-15T12:00:00.000Z',
      '3m',
      [
        ['2027-02-28', '1'],
        ['2027-03-01', '2'],
      ],
      { '2027-02': '1.0000', '2027-03': '2.0000' },
      ['2027-02', '2027-03', '2027-04'],
    ],
    [
      'the 28th and the 29th of February 2028 (a leap year) and the first of March',
      '2028-04-15T12:00:00.000Z',
      '3m',
      [
        ['2028-02-28', '1'],
        ['2028-02-29', '2'],
        ['2028-03-01', '4'],
      ],
      { '2028-02': '3.0000', '2028-03': '4.0000' },
      ['2028-02', '2028-03', '2028-04'],
    ],
    [
      'the last day of December and the first of January',
      '2027-02-15T12:00:00.000Z',
      '3m',
      [
        ['2026-12-31', '1'],
        ['2027-01-01', '2'],
      ],
      { '2026-12': '1.0000', '2027-01': '2.0000' },
      ['2026-12', '2027-01', '2027-02'],
    ],
  ] as const)('puts %s in their own months', async (_what, instant, period, days, income, months) => {
    const { a } = await stopClock(instant, world(), issueToken)
    await clearTransactions(prisma())
    await writeRows(
      prisma(),
      days.map(([date, amount]) => ({ accountId: a.accounts.main, type: 'income' as const, amount, date })),
    )

    const { trend } = currencyOf(await getDashboard(as(a), period), 'CZK')

    expect(trend.map(({ month }) => month)).toStrictEqual([...months])
    expect(trend.map(({ income: monthIncome }) => monthIncome)).toStrictEqual(
      months.map((month) => (income as Record<string, string>)[month] ?? ZERO),
    )
  })
})
