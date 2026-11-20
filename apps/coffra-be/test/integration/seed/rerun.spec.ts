import { describe, expect, it } from 'vitest'

import { DEMO_USER } from '../../../scripts/seed/constants'
import { seedDemo } from '../../../scripts/seed/seed-demo'
import { AuthSource, type PrismaService } from '../../../src/modules/prisma'
import { balancesOf, seededBalances } from '../support/responses'
import type { Snapshot } from '../support/snapshot'
import { useIntegrationApp } from '../support/use-integration-app'

import { seedAt } from './setup'

const CLOCK = '2026-10-30T12:00:00.000Z'

/**
 * Everything in the database that does not belong to the demo user.
 *
 * @param snapshot - the whole database
 * @param prisma - the client, to tell which accounts are the demo user's
 * @param userId - the demo user
 * @returns the snapshot without the demo user, its accounts, categories and transactions
 */
const withoutDemo = async (snapshot: Snapshot, prisma: PrismaService, userId: string): Promise<Snapshot> => {
  const accounts = await prisma.account.findMany({ where: { userId }, select: { id: true } })
  const own = new Set(accounts.map(({ id }) => id))

  return {
    users: snapshot.users.filter(({ id }) => id !== userId),
    accounts: snapshot.accounts.filter((account) => account.userId !== userId),
    categories: snapshot.categories.filter((category) => category.userId !== userId),
    transactions: snapshot.transactions.filter(({ accountId }) => !own.has(accountId)),
  }
}

// Running the seed again: the same figures from new rows, a new day replaces the old data instead of adding to it, only
// the demo user is touched.
describe('running the seed again', () => {
  const app = useIntegrationApp()
  const { prisma, snapshot } = app

  const rowsOf = async (userId: string) => ({
    accounts: await prisma().account.count({ where: { userId } }),
    categories: await prisma().category.count({ where: { userId } }),
    transactions: await prisma().transaction.count({ where: { account: { userId } } }),
  })

  it('creates the demo user with the identity of the dev realm when there is none', async () => {
    const before = await prisma().user.count({ where: { externalSubject: DEMO_USER.subject } })
    const { demo } = await seedAt(app, CLOCK)

    const user = await prisma().user.findUniqueOrThrow({ where: { id: demo.userId } })

    expect(before).toBe(0)
    expect([user.authSource, user.externalSubject, user.email]).toStrictEqual([
      AuthSource.oidc,
      DEMO_USER.subject,
      DEMO_USER.email,
    ])
  })

  it('uses the user who logged in before, and keeps the id', async () => {
    const existing = await prisma().user.create({
      data: { externalSubject: DEMO_USER.subject, email: 'renamed@coffra.test' },
    })

    const { demo } = await seedAt(app, CLOCK)

    const users = await prisma().user.findMany({ where: { externalSubject: DEMO_USER.subject } })

    expect(demo.userId).toBe(existing.id)
    expect(users.map(({ id, email }) => [id, email])).toStrictEqual([[existing.id, DEMO_USER.email]])
  })

  it('writes the same figures the second time, from new rows, and reports what it replaced', async () => {
    const first = await seedAt(app, CLOCK)
    const user = await prisma().user.findUniqueOrThrow({ where: { id: first.demo.userId } })
    const firstAccounts = await prisma().account.findMany({ where: { userId: first.demo.userId } })

    const second = await seedDemo(prisma(), '2026-10-30')

    const secondAccounts = await prisma().account.findMany({ where: { userId: first.demo.userId } })
    const same = await prisma().user.findUniqueOrThrow({ where: { id: first.demo.userId } })

    expect(second.userId).toBe(first.summary.userId)
    expect({ ...second, removed: undefined }).toStrictEqual({ ...first.summary, removed: undefined })
    expect(second.removed).toStrictEqual({
      accounts: first.summary.accounts,
      categories: first.summary.categories,
      transactions: first.summary.transactions,
    })
    expect(same.createdAt).toStrictEqual(user.createdAt)
    expect(secondAccounts.map(({ id }) => id).filter((id) => firstAccounts.some((old) => old.id === id))).toStrictEqual(
      [],
    )
    expect(
      secondAccounts.map(({ name, openingBalance }) => [name, openingBalance.toFixed(4)]).toSorted(),
    ).toStrictEqual(firstAccounts.map(({ name, openingBalance }) => [name, openingBalance.toFixed(4)]).toSorted())
    expect(await rowsOf(first.demo.userId)).toStrictEqual({ accounts: 4, categories: 9, transactions: 203 })
  })

  it('replaces the data of another day instead of adding to it', async () => {
    const first = await seedAt(app, CLOCK)

    const second = await seedDemo(prisma(), '2026-08-15')

    const oldest = await prisma().transaction.findFirstOrThrow({
      where: { account: { userId: first.demo.userId } },
      orderBy: { date: 'asc' },
    })

    expect(second.from).toBe('2025-09-01')
    expect(oldest.date.toISOString().slice(0, 10)).toBe('2025-09-02')
    expect(await rowsOf(first.demo.userId)).toStrictEqual({
      accounts: 4,
      categories: 9,
      transactions: second.transactions,
    })
    expect(second.transactions).not.toBe(first.summary.transactions)
  })

  it('removes what the demo user added by hand: the seed owns the whole account of that user', async () => {
    const first = await seedAt(app, CLOCK)
    const manual = await prisma().account.create({
      data: { userId: first.demo.userId, name: 'Moje', type: 'cash', currency: 'CZK' },
    })
    await prisma().transaction.create({
      data: { accountId: manual.id, type: 'expense', amount: '10', date: new Date('2026-10-01T00:00:00.000Z') },
    })

    const second = await seedDemo(prisma(), '2026-10-30')

    expect(second.removed).toStrictEqual({ accounts: 5, categories: 9, transactions: 204 })
    expect(await prisma().account.findFirst({ where: { name: 'Moje' } })).toBeNull()
  })

  it('leaves the other users exactly as they were, rows and balances', async () => {
    const { a, b } = app.world()
    const before = await snapshot()
    // Both users of the world had a balance before: it is the one the seed of the world works out.

    const seeded = await seedAt(app, CLOCK)

    const after = await snapshot()
    const rest = await withoutDemo(after, prisma(), seeded.demo.userId)

    expect(rest).toStrictEqual(before)
    const ofA = await app.as(seeded.a).get('/api/accounts').expect(200)
    const ofB = await app.as(seeded.b).get('/api/accounts').expect(200)

    expect(balancesOf(ofA.body)).toStrictEqual(seededBalances(a))
    expect(balancesOf(ofB.body)).toStrictEqual(seededBalances(b))
  })
})
