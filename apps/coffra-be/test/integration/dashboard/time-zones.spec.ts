import { describe, expect, it } from 'vitest'

import { useTimeZone } from '../../utils/use-time-zone'
import { stopClock } from '../support/clock'
import { currencyOf, expectConsistent, expectNotEmpty, getDashboard } from '../support/dashboard-checks'
import { type DashboardPeriod, sqlDashboard, utcDayOf } from '../support/dashboard-sql'
import { clearTransactions, seedLedger, writeRows } from '../support/ledger'
import { useIntegrationApp } from '../support/use-integration-app'

/** The two ends of the offsets, a day apart: the app runs in the process of the spec, so this is the zone of the server. */
const ZONES: [zone: string, offset: number][] = [
  ['Pacific/Kiritimati', -840],
  ['Pacific/Pago_Pago', 660],
]

/** The last second of January and the first of February in UTC: a local day apart in both zones. */
const EDGE_CLOCKS = ['2026-01-31T23:59:59.000Z', '2026-02-01T00:00:00.000Z']

const PERIODS: DashboardPeriod[] = ['3m', '6m', '1y']

/** Every clock with every period. */
const CLOCKS_AND_PERIODS = EDGE_CLOCKS.flatMap((instant) => PERIODS.map((period) => [instant, period] as const))

// "Today" and every day of the figures are days in UTC, whatever the time zone of the server: in UTC+14 it is already
// the next day for 14 hours of every day, in UTC−11 still the previous one. The unit specs prove the arithmetic; this
// proves it through the driver adapter, a real `DATE` column and a real `GROUP BY`.
describe('the dashboard in other time zones', () => {
  const { as, world, prisma, issueToken } = useIntegrationApp()

  describe.each(ZONES)('with the server in %s', (zone, offset) => {
    useTimeZone(zone, offset)

    it.each(CLOCKS_AND_PERIODS)('gives what the SQL adds up on %s for the period %s', async (instant, period) => {
      const { a } = await stopClock(instant, world(), issueToken)
      // Written now, in this zone, so the days of the ledger go through the adapter in it too.
      await seedLedger(prisma(), a, { seed: 20_261_028, scale: 1 })

      const expected = await sqlDashboard(prisma(), a.userId, { day: utcDayOf(instant), period })
      const body = await getDashboard(as(a), period)

      expectNotEmpty(expected)
      expect(body).toStrictEqual(expected)
      expectConsistent(body)
    })

    // [the clock, the first and the last day of the window of `3m`, the income of 31 January and 1 February it counts]
    it.each([
      ['2026-01-31T23:59:59.000Z', '2025-11-01', '2026-01-31', '1.0000'],
      ['2026-02-01T00:00:00.000Z', '2025-12-01', '2026-02-28', '3.0000'],
    ] as const)('on %s the window is %s .. %s, days in UTC', async (instant, from, to, income) => {
      const { a } = await stopClock(instant, world(), issueToken)
      await clearTransactions(prisma())
      await writeRows(prisma(), [
        { accountId: a.accounts.main, type: 'income', amount: '1', date: '2026-01-31' },
        { accountId: a.accounts.main, type: 'income', amount: '2', date: '2026-02-01' },
      ])

      const body = await getDashboard(as(a))

      expect([body.from, body.to]).toStrictEqual([from, to])
      expect(currencyOf(body, 'CZK').income).toBe(income)
    })

    it('puts rows written through the API and through Prisma in the same months', async () => {
      const { a } = await stopClock('2026-02-15T12:00:00.000Z', world(), issueToken)
      await clearTransactions(prisma())
      for (const [date, amount] of [
        ['2026-01-31', '1'],
        ['2026-02-01', '2'],
      ]) {
        await as(a).post('/api/transactions', { accountId: a.accounts.main, type: 'income', amount, date }).expect(201)
      }
      await writeRows(prisma(), [
        { accountId: a.accounts.main, type: 'income', amount: '4', date: '2026-01-31' },
        { accountId: a.accounts.main, type: 'income', amount: '8', date: '2026-02-01' },
      ])

      const { trend } = currencyOf(await getDashboard(as(a)), 'CZK')

      expect(trend.map(({ month, income }) => [month, income])).toStrictEqual([
        ['2025-12', '0.0000'],
        ['2026-01', '5.0000'],
        ['2026-02', '10.0000'],
      ])
    })
  })
})
