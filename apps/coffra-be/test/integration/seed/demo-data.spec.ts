import { describe, expect, it } from 'vitest'

import { expectConsistent, expectNotEmpty, getDashboard } from '../support/dashboard-checks'
import { type CurrencyBody, type DashboardBody, type DashboardPeriod, sqlDashboard } from '../support/dashboard-sql'
import { sqlBalances } from '../support/responses'
import { useIntegrationApp } from '../support/use-integration-app'

import { money, seedAt } from './setup'

/** The end of October 2026: every day the table uses is past, so the current month is complete. */
const CLOCK = '2026-10-30T12:00:00.000Z'
/** The middle of the month: only the days up to the 15th are history, and the planned payment (the 18th) is in the window. */
const MIDDLE_OF_MONTH = '2026-10-15T12:00:00.000Z'

/** One side of a transfer, as `GET /api/transactions` shows it. */
type TransferSide = {
  transferPairId: string
  transferDirection: 'in' | 'out'
  accountId: string
  categoryId: string | null
  amount: string
  date: string
  note: string
}

/** The twelve months of the window of `1y` on CLOCK. */
const MONTHS = [
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
]

/** The expense of each month in CZK and what is left of the salary, added up by hand from the table of the seed. */
const CZK_EXPENSE = [24_298, 24_298, 23_878, 24_638, 24_108, 23_878, 25_398, 24_338, 23_878, 24_698, 23_968, 23_878]
const CZK_NET = [27_702, 27_702, 28_122, 27_362, 27_892, 28_122, 26_602, 27_662, 28_122, 27_302, 28_032, 28_122]

/** `[income, expense, net]` of the months of the EUR account that are not zero. */
const EUR_MONTHS: Record<string, [number, number, number]> = {
  '2026-01': [800, 0, 800],
  '2026-03': [0, 450, -450],
  '2026-04': [800, 0, 800],
  '2026-07': [800, 0, 800],
  '2026-08': [0, 620, -620],
  '2026-10': [800, 0, 800],
}

// The demo data through the real API: the figures a person sees after `pnpm db:seed` and the first login, worked out by
// hand from the table of the seed, then compared with plain SQL for the periods the dashboard offers.
describe('the demo data', () => {
  const app = useIntegrationApp()
  const { as, prisma } = app

  const accountsOf = async (token: string, query = ''): Promise<Record<string, string>> => {
    const response = await as({ token }).get(`/api/accounts${query}`).expect(200)
    const accounts = response.body as { name: string; currency: string; balance: string }[]

    return Object.fromEntries(accounts.map(({ name, currency, balance }) => [`${name} (${currency})`, balance]))
  }

  describe('on the 30th of October 2026', () => {
    it('gives the four accounts the balances worked out by hand', async () => {
      const { demo } = await seedAt(app, CLOCK)

      expect(await accountsOf(demo.token)).toStrictEqual({
        'Běžný účet (CZK)': money(214_744),
        'Spořicí účet (CZK)': money(220_000),
        'Hotovost (CZK)': money(26_000),
        'Euro účet (EUR)': money(2630),
      })
    })

    it('agrees with the balances plain SQL adds up', async () => {
      const { demo } = await seedAt(app, CLOCK)
      const response = await as(demo).get('/api/accounts').expect(200)
      const accounts = response.body as { id: string; balance: string }[]

      expect(Object.fromEntries(accounts.map(({ id, balance }) => [id, balance]))).toStrictEqual(
        await sqlBalances(prisma(), demo.userId, '2026-10-30'),
      )
    })

    it('does not count the planned payment in the balance of today, and does once its day has come', async () => {
      const { demo } = await seedAt(app, CLOCK)

      const today = await accountsOf(demo.token)
      const planned = await accountsOf(demo.token, '?asOf=2026-11-02')

      expect(today['Běžný účet (CZK)']).toBe(money(214_744))
      expect(planned['Běžný účet (CZK)']).toBe(money(206_344))
    })

    it('gives the dashboard of a year with the figures worked out by hand', async () => {
      const { demo } = await seedAt(app, CLOCK)
      const categories = await prisma().category.findMany({ where: { userId: demo.userId } })
      const ids = Object.fromEntries(categories.map(({ id, name }) => [name, id]))
      const category = (name: string | null, income: number, expense: number, net: number) => ({
        categoryId: name === null ? null : ids[name],
        name,
        income: money(income),
        expense: money(expense),
        net: money(net),
      })

      const czk: CurrencyBody = {
        currency: 'CZK',
        income: money(624_000),
        expense: money(291_256),
        net: money(332_744),
        categories: [
          category('Mzda', 624_000, 0, 624_000),
          category('Bydlení', 0, 201_600, -201_600),
          category('Jídlo', 0, 64_440, -64_440),
          category('Zábava', 0, 9400, -9400),
          category('Doprava', 0, 6600, -6600),
          category('Předplatná', 0, 3936, -3936),
          category('Zdraví', 0, 1680, -1680),
          category(null, 0, 3600, -3600),
        ],
        trend: MONTHS.map((month, index) => ({
          month,
          income: money(52_000),
          expense: money(CZK_EXPENSE[index]),
          net: money(CZK_NET[index]),
        })),
      }
      const eur: CurrencyBody = {
        currency: 'EUR',
        income: money(3200),
        expense: money(1070),
        net: money(2130),
        categories: [category('Vedlejší příjem', 3200, 0, 3200), category('Cestování', 0, 1070, -1070)],
        trend: MONTHS.map((month) => {
          const [income, expense, net] = EUR_MONTHS[month] ?? [0, 0, 0]

          return { month, income: money(income), expense: money(expense), net: money(net) }
        }),
      }

      const body = await getDashboard(as(demo), '1y')

      expect(body).toStrictEqual({ period: '1y', from: '2025-11-01', to: '2026-10-31', currencies: [czk, eur] })
      expectConsistent(body)
    })

    it('gives the last three months their share of the year', async () => {
      const { demo } = await seedAt(app, CLOCK)

      const { currencies } = await getDashboard(as(demo), '3m')

      expect(currencies.map(({ currency, income, expense }) => [currency, income, expense])).toStrictEqual([
        ['CZK', money(156_000), money(72_544)],
        ['EUR', money(800), money(620)],
      ])
    })

    it.each<DashboardPeriod>(['3m', '6m', '1y'])('agrees with plain SQL for the period %s', async (period) => {
      const { demo } = await seedAt(app, CLOCK)

      const expected: DashboardBody = await sqlDashboard(prisma(), demo.userId, { day: '2026-10-30', period })
      const body = await getDashboard(as(demo), period)

      expectNotEmpty(expected)
      expect(body).toStrictEqual(expected)
      expectConsistent(body)
    })

    it('lists the planned payment first and every transfer as two sides of one pair', async () => {
      const { demo } = await seedAt(app, CLOCK)

      const all = await as(demo).get('/api/transactions?limit=100').expect(200)
      const transfers = await as(demo).get('/api/transactions?type=transfer&limit=100').expect(200)
      const list = all.body as { items: Record<string, unknown>[]; nextCursor: string | null }
      const sides = (transfers.body as { items: TransferSide[] }).items

      expect(list.items[0]).toMatchObject({
        type: 'expense',
        amount: money(8400),
        date: '2026-11-02',
        note: 'Pojištění auta (plánovaná platba)',
        transferPairId: null,
      })
      expect(sides).toHaveLength(48)

      const pairs = new Map<string, TransferSide[]>()

      for (const side of sides) {
        pairs.set(side.transferPairId, [...(pairs.get(side.transferPairId) ?? []), side])
      }

      expect(pairs.size).toBe(24)

      for (const [pair, pairSides] of pairs) {
        const [first, second] = pairSides

        expect(pairSides.map((side) => side.transferDirection).toSorted(), `pair ${pair}`).toStrictEqual(['in', 'out'])
        expect(second.amount).toBe(first.amount)
        expect(second.date).toBe(first.date)
        expect(second.note).toBe(first.note)
        expect(second.accountId).not.toBe(first.accountId)
        expect([first.categoryId, second.categoryId]).toStrictEqual([null, null])
      }
    })

    it('gives the demo user the nine categories', async () => {
      const { demo } = await seedAt(app, CLOCK)

      const response = await as(demo).get('/api/categories').expect(200)

      expect((response.body as { name: string }[]).map(({ name }) => name).toSorted()).toStrictEqual(
        [
          'Bydlení',
          'Cestování',
          'Doprava',
          'Jídlo',
          'Mzda',
          'Předplatná',
          'Vedlejší příjem',
          'Zábava',
          'Zdraví',
        ].toSorted(),
      )
    })
  })

  describe('in the middle of October 2026', () => {
    it('counts the planned payment in the dashboard of the window but not in the balance of today', async () => {
      const { demo } = await seedAt(app, MIDDLE_OF_MONTH)

      const body = await getDashboard(as(demo), '1y')
      const transport = body.currencies[0]?.categories.find(({ name }) => name === 'Doprava')
      const today = await accountsOf(demo.token)
      const later = await accountsOf(demo.token, '?asOf=2026-10-31')

      expect(transport?.expense).toBe(money(15_000))
      expect(Number(today['Běžný účet (CZK)']) - Number(later['Běžný účet (CZK)'])).toBe(8400)
    })

    it('dates one row after today, the planned payment, and nothing else', async () => {
      const { demo } = await seedAt(app, MIDDLE_OF_MONTH)

      const ahead = await prisma().transaction.findMany({
        where: { account: { userId: demo.userId }, date: { gt: new Date('2026-10-15T00:00:00.000Z') } },
      })

      expect(ahead.map(({ date, type, note }) => [date.toISOString().slice(0, 10), type, note])).toStrictEqual([
        ['2026-10-18', 'expense', 'Pojištění auta (plánovaná platba)'],
      ])
    })

    it.each<DashboardPeriod>(['3m', '6m', '1y'])('agrees with plain SQL for the period %s', async (period) => {
      const { demo } = await seedAt(app, MIDDLE_OF_MONTH)

      const expected = await sqlDashboard(prisma(), demo.userId, { day: '2026-10-15', period })
      const body = await getDashboard(as(demo), period)

      expectNotEmpty(expected)
      expect(body).toStrictEqual(expected)
    })
  })
})
