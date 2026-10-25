import { describe, expect, it } from 'vitest'

import { formatIsoDate } from '../../../src/utils'
import { balancesOf, seededBalances, sqlBalances } from '../support/responses'
import { useIntegrationApp } from '../support/use-integration-app'
import type { Persona } from '../support/world'

// The balances of `GET /api/accounts` and `GET /api/accounts/:id` (with and without `asOf`) against writes of the
// other user. The routes themselves are covered in `accounts.spec.ts`.
describe('isolation of balances', () => {
  const { as, anonymous, world, prisma } = useIntegrationApp()

  /** Every balance the API shows `persona`: the list and every detail, today and as of a past day. */
  const everyBalanceOf = async (persona: Persona) => {
    const read = async (query: string) => {
      const listed = await as(persona).get(`/api/accounts${query}`).expect(200)
      const list = balancesOf(listed.body)
      const details: Record<string, string> = {}

      // One request at a time (see `maxWorkers` in `vitest.config.mjs`).
      for (const id of Object.values(persona.accounts)) {
        const response = await as(persona).get(`/api/accounts/${id}${query}`).expect(200)
        details[id] = (response.body as { balance: string }).balance
      }

      return { list, details }
    }

    return { today: await read(''), past: await read('?asOf=2026-01-12') }
  }

  /** Writes of `b` through the API that move the balances of `b`: income, expense, transfer, opening balance, delete. */
  const writeAsB = async (b: Persona): Promise<void> => {
    await as(b)
      .post('/api/transactions', { accountId: b.accounts.main, type: 'income', amount: '999999', date: '2026-01-11' })
      .expect(201)
    await as(b)
      .post('/api/transactions', { accountId: b.accounts.savings, type: 'expense', amount: '5', date: '2026-01-12' })
      .expect(201)
    await as(b)
      .post('/api/transfers', {
        fromAccountId: b.accounts.savings,
        toAccountId: b.accounts.empty,
        amount: '77',
        date: '2026-01-01',
      })
      .expect(201)
    await as(b).patch(`/api/accounts/${b.accounts.main}`, { openingBalance: '-123456' }).expect(200)
    await as(b).delete(`/api/transactions/${b.transactions.expense}`).expect(204)
  }

  it('turns a request without a token away', async () => {
    await anonymous().get(`/api/accounts?asOf=2026-01-12`).expect(401)
  })

  it('keeps every balance of the caller as it is when the other user writes', async () => {
    const { a, b } = world()
    const before = await everyBalanceOf(a)

    await writeAsB(b)

    expect(await everyBalanceOf(a)).toStrictEqual(before)
    expect(before.today.list).toStrictEqual(seededBalances(a))
  })

  it('moves the balances of the other user with their own writes (control)', async () => {
    const { b } = world()
    const before = await everyBalanceOf(b)

    await writeAsB(b)

    expect(await everyBalanceOf(b)).not.toStrictEqual(before)
  })

  it('gives each user exactly the balances plain SQL computes from their rows', async () => {
    const { a, b } = world()
    await writeAsB(b)
    const today = formatIsoDate(new Date())

    for (const persona of [a, b]) {
      const response = await as(persona).get('/api/accounts').expect(200)
      const past = await as(persona).get('/api/accounts?asOf=2026-01-12').expect(200)

      expect(balancesOf(response.body)).toStrictEqual(await sqlBalances(prisma(), persona.userId, today))
      expect(balancesOf(past.body)).toStrictEqual(await sqlBalances(prisma(), persona.userId, '2026-01-12'))
    }
  })
})
