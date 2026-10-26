import { describe, expect, it, vi } from 'vitest'

import { useIntegrationApp } from '../support/use-integration-app'
import type { Persona } from '../support/world'

/**
 * Where the clock stands: with it the window of `3m` is 2025-12-01 .. 2026-02-28 and holds every seeded day (all in
 * January 2026). The seed is dated in the past while the window is counted from today, so without a fixed clock these
 * specs would start to fail once the seeded days leave the window.
 */
const CLOCK = '2026-02-15T12:00:00.000Z'

type Dashboard = { currencies: { currency: string }[] }

type Figures = { income: string; expense: string; net: string }

/** What the seed adds up to for `a`, and for `b` (a thousand times as much): the income, the expense and the net. */
const A_FIGURES: Figures = { income: '2500.0000', expense: '300.2500', net: '2199.7500' }
const B_FIGURES: Figures = { income: '2500000.0000', expense: '300250.0000', net: '2199750.0000' }

/**
 * The dashboard the seed gives a user: one currency (CZK; the euro account has only an opening balance, and the
 * transfer is not income or expense), the salary larger than the groceries.
 *
 * @param persona - the user
 * @param figures - the amounts of the seed of that user
 * @param window - the period and the days it covers
 * @returns the body of the answer
 */
const seeded = (persona: Persona, figures: Figures, window: { period: string; from: string; to: string }) => ({
  ...window,
  currencies: [
    {
      currency: 'CZK',
      ...figures,
      categories: [
        {
          categoryId: persona.categories.salary,
          name: 'Salary',
          income: figures.income,
          expense: '0.0000',
          net: figures.income,
        },
        {
          categoryId: persona.categories.food,
          name: 'Food',
          income: '0.0000',
          expense: figures.expense,
          net: `-${figures.expense}`,
        },
      ],
    },
  ],
})

/** The answer for a window that holds nothing. */
const nothing = (window: { period: string; from: string; to: string }) => ({ ...window, currencies: [] })

const WINDOW = { period: '3m', from: '2025-12-01', to: '2026-02-28' }

// The dashboard against writes of the other user. The seed gives both users the same structure, `b` a thousand times
// the amounts, so a row of `b` that reached the figures of `a` cannot go unnoticed.
describe('isolation of the dashboard', () => {
  const { as, anonymous, world, issueToken, unchanged } = useIntegrationApp()

  /** Stops the clock at `instant` and gives both users a token signed by that clock (the seeded ones are not). */
  const atClock = async (instant: string): Promise<{ a: Persona; b: Persona }> => {
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(instant) })
    const { a, b } = world()

    return {
      a: { ...a, token: await issueToken(a.userId) },
      b: { ...b, token: await issueToken(b.userId) },
    }
  }

  /** The dashboard `persona` is shown, as the API answered it. */
  const dashboardOf = async (persona: Pick<Persona, 'token'>, query = ''): Promise<Dashboard> => {
    const response = await as(persona).get(`/api/dashboard${query}`).expect(200)

    return response.body as Dashboard
  }

  /** Writes of `b` through the API that move its dashboard: income, expense, transfer, a new currency, a delete. */
  const writeAsB = async (b: Persona): Promise<void> => {
    await as(b)
      .post('/api/transactions', {
        accountId: b.accounts.main,
        type: 'income',
        amount: '999999',
        date: '2026-01-11',
        categoryId: b.categories.salary,
      })
      .expect(201)
    await as(b)
      .post('/api/transactions', {
        accountId: b.accounts.savings,
        type: 'expense',
        amount: '5',
        date: '2026-01-12',
        categoryId: b.categories.unused,
      })
      .expect(201)
    await as(b)
      .post('/api/transfers', {
        fromAccountId: b.accounts.savings,
        toAccountId: b.accounts.empty,
        amount: '77',
        date: '2026-01-01',
      })
      .expect(201)

    // A currency `a` does not have.
    const dollars = await as(b).post('/api/accounts', { name: 'Dollars', type: 'bank', currency: 'USD' }).expect(201)
    await as(b)
      .post('/api/transactions', {
        accountId: (dollars.body as { id: string }).id,
        type: 'income',
        amount: '50',
        date: '2026-01-20',
      })
      .expect(201)

    await as(b).delete(`/api/transactions/${b.transactions.expense}`).expect(204)
    await as(b).patch(`/api/accounts/${b.accounts.main}`, { openingBalance: '-123456' }).expect(200)
  }

  describe('GET /api/dashboard', () => {
    it('turns a request without a token away', async () => {
      await anonymous().get('/api/dashboard').expect(401)
    })

    it('gives the caller the figures of their own rows: income and expense, no transfer, no opening balance', async () => {
      const { a } = await atClock(CLOCK)

      const response = await as(a).get('/api/dashboard').expect(200)

      expect(response.body).toStrictEqual(seeded(a, A_FIGURES, WINDOW))
    })

    it('gives the other user the same shape with their own figures (control)', async () => {
      const { b } = await atClock(CLOCK)

      const response = await as(b).get('/api/dashboard').expect(200)

      expect(response.body).toStrictEqual(seeded(b, B_FIGURES, WINDOW))
    })

    it('keeps the dashboard of the caller as it is when the other user writes', async () => {
      const { a, b } = await atClock(CLOCK)
      const before = await dashboardOf(a)

      await writeAsB(b)

      const after = await dashboardOf(a)

      expect(after).toStrictEqual(before)
      expect(after.currencies.map(({ currency }) => currency)).toStrictEqual(['CZK'])
      expect(after).toStrictEqual(seeded(a, A_FIGURES, WINDOW))
    })

    it('moves the dashboard of the other user with their own writes (control)', async () => {
      const { b } = await atClock(CLOCK)
      const before = await dashboardOf(b)

      await writeAsB(b)

      const after = await dashboardOf(b)

      expect(after).not.toStrictEqual(before)
      expect(after.currencies.map(({ currency }) => currency)).toStrictEqual(['CZK', 'USD'])
    })

    it('takes the owner from the token only: the query cannot name another one', async () => {
      const { a, b } = await atClock(CLOCK)

      const response = await as(a).get(`/api/dashboard?userId=${b.userId}&owner=${b.userId}`).expect(200)

      expect(response.body).toStrictEqual(seeded(a, A_FIGURES, WINDOW))
    })

    it('answers 400 to a period it does not offer, and writes nothing', async () => {
      const { a } = await atClock(CLOCK)

      await unchanged(async () => {
        await as(a).get('/api/dashboard?period=2m').expect(400)
        await as(a).get('/api/dashboard?period=3m&period=6m').expect(400)
      })
      // Control: the same caller and clock with a valid period are answered.
      await as(a).get('/api/dashboard?period=3m').expect(200)
    })

    // The whole way from `period` to the figures: the days come from the clock and the period, the figures from the
    // rows in those days. The seeded days are in January 2026.
    describe.each([
      // [clock, period, from, to, whether January 2026 is inside]
      ['2026-04-15T10:00:00.000Z', '3m', '2026-02-01', '2026-04-30', false],
      ['2026-04-15T10:00:00.000Z', '6m', '2025-11-01', '2026-04-30', true],
      ['2026-04-15T10:00:00.000Z', '1y', '2025-05-01', '2026-04-30', true],
      ['2026-01-31T23:59:59.000Z', '3m', '2025-11-01', '2026-01-31', true],
      ['2026-02-01T00:00:00.000Z', '3m', '2025-12-01', '2026-02-28', true],
      ['2026-03-01T00:00:00.000Z', '3m', '2026-01-01', '2026-03-31', true],
      ['2026-04-01T00:00:00.000Z', '3m', '2026-02-01', '2026-04-30', false],
    ] as const)('on %s with the period %s', (instant, period, from, to, inside) => {
      it(`covers ${from} .. ${to} and ${inside ? 'counts' : 'leaves out'} the seeded days`, async () => {
        const { a } = await atClock(instant)
        const window = { period, from, to }

        const response = await as(a).get(`/api/dashboard?period=${period}`).expect(200)

        expect(response.body).toStrictEqual(inside ? seeded(a, A_FIGURES, window) : nothing(window))
      })
    })

    it('uses the period 3m when none is given', async () => {
      const { a } = await atClock('2026-04-15T10:00:00.000Z')

      const response = await as(a).get('/api/dashboard').expect(200)

      expect(response.body).toStrictEqual(nothing({ period: '3m', from: '2026-02-01', to: '2026-04-30' }))
    })
  })
})
