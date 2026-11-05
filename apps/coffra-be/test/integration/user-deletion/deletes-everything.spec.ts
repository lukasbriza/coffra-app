import { randomUUID } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { TransactionType } from '../../../src/modules/prisma'
import { formatIsoDate, parseIsoDate } from '../../../src/utils'
import { accountIdsOf, ownedRows } from '../support/owned-rows'
import { useIntegrationApp } from '../support/use-integration-app'
import { ownIds } from '../support/world'

/** The route that deletes the signed-in user. */
const DELETION = '/api/users/me/deletion'

/**
 * The ids of some rows.
 *
 * @param rows - rows of any table
 * @returns their ids
 */
const ids = (rows: { id: string }[]): string[] => rows.map(({ id }) => id)

// A user with accounts in two currencies, categories (one unused), an income, an expense, a transfer, a transaction
// without a category and a planned one is deleted with every row they own, in one request.
describe('deleting a user with all their data', () => {
  const { as, world, prisma, snapshot, issueToken } = useIntegrationApp()

  /** Adds what the seed of `a` lacks: a transaction without a category and one dated in the future. */
  const addOddTransactions = async (): Promise<void> => {
    const { a } = world()
    const nextYear = new Date()
    nextYear.setUTCFullYear(nextYear.getUTCFullYear() + 1)

    await prisma().transaction.createMany({
      data: [
        {
          id: randomUUID(),
          accountId: a.accounts.empty,
          type: TransactionType.expense,
          amount: '12.5',
          date: parseIsoDate('2026-01-20'),
        },
        {
          id: randomUUID(),
          accountId: a.accounts.euro,
          type: TransactionType.income,
          amount: '99',
          date: parseIsoDate(formatIsoDate(nextYear)),
          categoryId: a.categories.unused,
        },
      ],
    })
  }

  it('leaves no row of the user in any table', async () => {
    const { a } = world()
    await addOddTransactions()
    const before = await snapshot()
    const accountIds = accountIdsOf(before, a.userId)

    // What there is to delete: the comparison afterwards is not of empty lists.
    expect(ownedRows(before, a.userId, accountIds).users).toHaveLength(1)
    expect(ownedRows(before, a.userId, accountIds).accounts).toHaveLength(4)
    expect(ownedRows(before, a.userId, accountIds).categories).toHaveLength(3)
    expect(ownedRows(before, a.userId, accountIds).transactions).toHaveLength(6)

    await as(a).post(DELETION, { confirm: a.email }).expect(204)

    expect(ownedRows(await snapshot(), a.userId, accountIds)).toStrictEqual({
      users: [],
      accounts: [],
      categories: [],
      transactions: [],
    })
  })

  it('leaves no id the user had: the user, the accounts, the categories, both sides of the transfer', async () => {
    const { a } = world()

    await as(a).post(DELETION, { confirm: a.email }).expect(204)

    const after = await snapshot()
    const own = new Set([
      a.userId,
      ...ownIds(a.accounts),
      ...ownIds(a.categories),
      ...ownIds(a.transactions),
      a.transfer.out,
      a.transfer.in,
    ])
    const left = [...ids(after.users), ...ids(after.accounts), ...ids(after.categories), ...ids(after.transactions)]

    expect(left.filter((id) => own.has(id))).toStrictEqual([])
    expect(after.transactions.filter(({ transferPairId }) => transferPairId === a.transfer.pairId)).toStrictEqual([])
  })

  it('removes exactly the rows of the user, nothing more', async () => {
    const { a } = world()
    await addOddTransactions()
    const before = await snapshot()
    const own = ownedRows(before, a.userId)

    await as(a).post(DELETION, { confirm: a.email }).expect(204)

    const after = await snapshot()
    expect(after.users).toHaveLength(before.users.length - own.users.length)
    expect(after.accounts).toHaveLength(before.accounts.length - own.accounts.length)
    expect(after.categories).toHaveLength(before.categories.length - own.categories.length)
    expect(after.transactions).toHaveLength(before.transactions.length - own.transactions.length)
  })

  it('deletes a user who owns nothing but the user row', async () => {
    const user = await prisma().user.create({ data: { email: 'empty@coffra.test', externalSubject: randomUUID() } })
    const token = await issueToken(user.id)

    await as({ token }).post(DELETION, { confirm: 'empty@coffra.test' }).expect(204)

    expect(await prisma().user.findUnique({ where: { id: user.id } })).toBeNull()
  })
})
