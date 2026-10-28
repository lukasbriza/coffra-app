import { describe, expect, it } from 'vitest'

import { stopClock } from '../support/clock'
import { currencyOf, expectConsistent, getDashboard } from '../support/dashboard-checks'
import { sqlDashboard } from '../support/dashboard-sql'
import { clearTransactions, type Row, writeRows } from '../support/ledger'
import { useIntegrationApp } from '../support/use-integration-app'

/** The largest amount a `Decimal(19,4)` column takes: 15 integer digits and 4 decimal places, 19 significant digits. */
const LARGEST = '999999999999999.9999'

/**
 * `count` rows of the largest amount.
 *
 * @param accountId - where
 * @param count - how many
 * @param date - the day
 * @param categoryId - the category
 * @returns the rows
 */
const largest = (accountId: string, count: number, date: string, categoryId: string): Row[] =>
  Array.from({ length: count }, () => ({ accountId, type: 'income' as const, amount: LARGEST, date, categoryId }))

// Sums beyond the 20 significant digits of a default `Prisma.Decimal`. Postgres adds the rows of one account and one
// day exactly; the app then adds the accounts of one currency, the categories and the months, and any of those
// additions that started from a plain `Prisma.Decimal(0)` would round.
describe('the dashboard with amounts of more than 20 significant digits', () => {
  const { as, world, prisma, issueToken } = useIntegrationApp()

  it('adds the accounts, the categories and the months exactly', async () => {
    const { a } = await stopClock('2026-10-15T12:00:00.000Z', world(), issueToken)
    const { main, savings, empty } = a.accounts
    await clearTransactions(prisma())
    // September: 7 rows on each of three accounts of one currency, so every account sums to 6999999999999999.9993
    // (20 digits) and the three of them to 20999999999999999.9979 (21 digits). October: 5 rows on one account.
    await writeRows(prisma(), [
      ...largest(main, 7, '2026-09-10', a.categories.salary),
      ...largest(savings, 7, '2026-09-10', a.categories.salary),
      ...largest(empty, 7, '2026-09-10', a.categories.salary),
      ...largest(main, 5, '2026-10-10', a.categories.food),
      { accountId: main, type: 'expense', amount: '0.0001', date: '2026-09-11' },
    ])

    const body = await getDashboard(as(a))

    // Income of the two categories: 20999999999999999.9979 + 4999999999999999.9995 = 25999999999999999.9974.
    expect(currencyOf(body, 'CZK')).toStrictEqual({
      currency: 'CZK',
      income: '25999999999999999.9974',
      expense: '0.0001',
      net: '25999999999999999.9973',
      categories: [
        {
          categoryId: a.categories.salary,
          name: 'Salary',
          income: '20999999999999999.9979',
          expense: '0.0000',
          net: '20999999999999999.9979',
        },
        {
          categoryId: a.categories.food,
          name: 'Food',
          income: '4999999999999999.9995',
          expense: '0.0000',
          net: '4999999999999999.9995',
        },
        { categoryId: null, name: null, income: '0.0000', expense: '0.0001', net: '-0.0001' },
      ],
      trend: [
        { month: '2026-08', income: '0.0000', expense: '0.0000', net: '0.0000' },
        { month: '2026-09', income: '20999999999999999.9979', expense: '0.0001', net: '20999999999999999.9978' },
        { month: '2026-10', income: '4999999999999999.9995', expense: '0.0000', net: '4999999999999999.9995' },
      ],
    })
    expectConsistent(body)
    expect(body).toStrictEqual(await sqlDashboard(prisma(), a.userId, { day: '2026-10-15', period: '3m' }))
  })

  it('adds decimal fractions without binary rounding', async () => {
    const { a } = await stopClock('2026-10-15T12:00:00.000Z', world(), issueToken)
    await clearTransactions(prisma())
    await writeRows(prisma(), [
      {
        accountId: a.accounts.main,
        type: 'income',
        amount: '0.1',
        date: '2026-09-10',
        categoryId: a.categories.salary,
      },
      {
        accountId: a.accounts.savings,
        type: 'income',
        amount: '0.2',
        date: '2026-09-10',
        categoryId: a.categories.salary,
      },
    ])

    const czk = currencyOf(await getDashboard(as(a)), 'CZK')

    expect(czk.income).toBe('0.3000')
    expect(czk.categories[0].income).toBe('0.3000')
    expect(czk.trend[1].income).toBe('0.3000')
  })
})
