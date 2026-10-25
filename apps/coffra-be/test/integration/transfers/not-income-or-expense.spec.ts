import { describe, expect, it } from 'vitest'

import { Prisma } from '../../../src/modules/prisma'
import { balancesOf } from '../support/responses'
import { useIntegrationApp } from '../support/use-integration-app'

type Page = { items: { id: string }[] }

/**
 * The sum of balances, with four decimal places.
 *
 * @param balances - balances by account id
 * @returns their sum
 */
const sum = (balances: Record<string, string>): string => {
  let total = new Prisma.Decimal(0)

  for (const balance of Object.values(balances)) {
    total = total.plus(balance)
  }

  return total.toFixed(4)
}

// A transfer only moves money between own accounts: it is never listed as income or expense, and it leaves the sum of
// the balances of the owner in its currency where it was.
describe('a transfer is neither income nor expense', () => {
  const { as, world } = useIntegrationApp()

  const idsOfType = async (type: string): Promise<string[]> => {
    const response = await as(world().a).get(`/api/transactions?type=${type}`).expect(200)

    return (response.body as Page).items.map(({ id }) => id).toSorted()
  }

  /** The balances of the CZK accounts of `a`, by account id. */
  const czkBalances = async (): Promise<Record<string, string>> => {
    const response = await as(world().a).get('/api/accounts').expect(200)
    const accounts = response.body as { id: string; currency: string; balance: string }[]

    return balancesOf(accounts.filter(({ currency }) => currency === 'CZK'))
  }

  it('lists the sides of a transfer under the type transfer only', async () => {
    const { a } = world()

    expect(await idsOfType('income')).toStrictEqual([a.transactions.income])
    expect(await idsOfType('expense')).toStrictEqual([a.transactions.expense])
    expect(await idsOfType('transfer')).toStrictEqual([a.transfer.out, a.transfer.in].toSorted())
  })

  it('moves the amount between the two accounts and keeps their sum', async () => {
    const { a } = world()
    const before = await czkBalances()

    const response = await as(a)
      .post('/api/transfers', {
        fromAccountId: a.accounts.main,
        toAccountId: a.accounts.empty,
        amount: '100',
        date: '2026-02-01',
      })
      .expect(201)
    const after = await czkBalances()

    expect(response.body).toMatchObject({ amount: '100.0000' })
    expect(after).toStrictEqual({
      ...before,
      [a.accounts.main]: new Prisma.Decimal(before[a.accounts.main] ?? '').minus(100).toFixed(4),
      [a.accounts.empty]: new Prisma.Decimal(before[a.accounts.empty] ?? '').plus(100).toFixed(4),
    })
    expect(sum(after)).toBe(sum(before))
    expect(await idsOfType('income')).toStrictEqual([a.transactions.income])
    expect(await idsOfType('expense')).toStrictEqual([a.transactions.expense])
    expect(await idsOfType('transfer')).toHaveLength(4)
  })
})
