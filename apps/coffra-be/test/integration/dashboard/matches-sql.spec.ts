import { describe, expect, it } from 'vitest'

import { stopClock } from '../support/clock'
import { expectConsistent, expectNotEmpty, getDashboard } from '../support/dashboard-checks'
import { type DashboardPeriod, sqlDashboard, utcDayOf } from '../support/dashboard-sql'
import { seedLedger } from '../support/ledger'
import { useIntegrationApp } from '../support/use-integration-app'

/** Where the clock stands: the middle of a month, the edges of months and years, a leap day, a month with plans ahead. */
const CLOCKS = [
  '2026-02-15T12:00:00.000Z',
  '2026-01-31T23:59:59.999Z',
  '2026-02-01T00:00:00.000Z',
  '2028-02-29T12:00:00.000Z',
  '2027-01-01T00:00:00.000Z',
  '2026-12-31T23:59:59.999Z',
  '2027-06-10T08:30:00.000Z',
]

const PERIODS: DashboardPeriod[] = ['3m', '6m', '1y']

/** The two ledgers differ in their rows and in size: every amount of the second user is a thousand times as large. */
const LEDGER_A = { seed: 20_261_028, scale: 1 }
const LEDGER_B = { seed: 7001, scale: 1000 }

// The numbers of the API against plain SQL, over a ledger with every kind of row in every month: income and expense in
// four currencies on several accounts of one currency, transfers, rows without a category, planned payments. Both users
// have one, so a row that reached the figures of the other one cannot go unnoticed.
describe('the dashboard against an independent SQL', () => {
  const { as, world, prisma, issueToken } = useIntegrationApp()

  describe('the SQL itself', () => {
    it('gives the figures of the seed of the world, which the isolation specs write out by hand', async () => {
      const { a } = world()

      const body = await sqlDashboard(prisma(), a.userId, { day: '2026-02-15', period: '3m' })

      expect(body).toStrictEqual({
        period: '3m',
        from: '2025-12-01',
        to: '2026-02-28',
        currencies: [
          {
            currency: 'CZK',
            income: '2500.0000',
            expense: '300.2500',
            net: '2199.7500',
            categories: [
              {
                categoryId: a.categories.salary,
                name: 'Salary',
                income: '2500.0000',
                expense: '0.0000',
                net: '2500.0000',
              },
              {
                categoryId: a.categories.food,
                name: 'Food',
                income: '0.0000',
                expense: '300.2500',
                net: '-300.2500',
              },
            ],
            trend: [
              { month: '2025-12', income: '0.0000', expense: '0.0000', net: '0.0000' },
              { month: '2026-01', income: '2500.0000', expense: '300.2500', net: '2199.7500' },
              { month: '2026-02', income: '0.0000', expense: '0.0000', net: '0.0000' },
            ],
          },
        ],
      })
    })

    it.each([
      ['3m', 3],
      ['6m', 6],
      ['1y', 12],
    ] as const)('has every month of the window of the period %s', async (period, months) => {
      const { a } = world()

      const { currencies } = await sqlDashboard(prisma(), a.userId, { day: '2026-02-15', period })

      expect(currencies.map(({ trend }) => trend.length)).toStrictEqual([months])
    })
  })

  describe.each(CLOCKS)('on %s', (instant) => {
    it.each(PERIODS)('gives each user what the SQL adds up for the period %s', async (period) => {
      const { a, b } = await stopClock(instant, world(), issueToken)
      await seedLedger(prisma(), a, LEDGER_A)
      await seedLedger(prisma(), b, LEDGER_B)
      const day = utcDayOf(instant)

      const expectedA = await sqlDashboard(prisma(), a.userId, { day, period })
      const expectedB = await sqlDashboard(prisma(), b.userId, { day, period })
      const bodyA = await getDashboard(as(a), period)
      const bodyB = await getDashboard(as(b), period)

      // The comparison is worth something: the windows hold data, and the two users do not have the same figures.
      expectNotEmpty(expectedA)
      expectNotEmpty(expectedB)
      expect(expectedB).not.toStrictEqual(expectedA)

      expect(bodyA).toStrictEqual(expectedA)
      expect(bodyB).toStrictEqual(expectedB)
      expectConsistent(bodyA)
      expectConsistent(bodyB)
    })
  })
})
