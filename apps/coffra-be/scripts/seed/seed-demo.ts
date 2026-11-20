import { randomUUID } from 'node:crypto'

import { AuthSource, type Prisma, TransactionType, TransferDirection } from '../../src/modules/prisma'
import { parseIsoDate } from '../../src/utils'

import { buildLedger } from './build-ledger'
import { DEMO_USER } from './constants'
import type { SeedClient, SeedSummary } from './types'
import { idOf } from './utils/id-of'

/**
 * Gives the demo user a fresh set of demo data for a day, in one database transaction: the user is found or created, all
 * it owns is deleted, and the data of `buildLedger` is written. A failure anywhere leaves what was there before, so a run
 * can be repeated and never leaves half of the data.
 *
 * Only the rows of the demo user are touched, and the user row itself stays (its id and the tokens issued for it keep
 * working). This is a tool for the development database, not a domain service: it writes the owner itself instead of
 * going through the ownership layer of the app.
 *
 * @param client - the database client
 * @param today - the day the data is made for, `YYYY-MM-DD` (UTC)
 * @returns what was written and what it replaced
 * @throws Error when the data refers to an account or a category it does not define
 */
export const seedDemo = (client: SeedClient, today: string): Promise<SeedSummary> => {
  const ledger = buildLedger(today)

  return client.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { authSource_externalSubject: { authSource: AuthSource.oidc, externalSubject: DEMO_USER.subject } },
      create: { authSource: AuthSource.oidc, externalSubject: DEMO_USER.subject, email: DEMO_USER.email },
      update: { email: DEMO_USER.email },
    })

    // Both foreign keys of a transaction are `Restrict`: transactions go first, then what they refer to.
    const { count: transactions } = await tx.transaction.deleteMany({ where: { account: { userId: user.id } } })
    const { count: accounts } = await tx.account.deleteMany({ where: { userId: user.id } })
    const { count: categories } = await tx.category.deleteMany({ where: { userId: user.id } })

    const accountIds = new Map(ledger.accounts.map(({ name }) => [name, randomUUID()]))
    const categoryIds = new Map(ledger.categories.map((name) => [name, randomUUID()]))

    await tx.account.createMany({
      data: ledger.accounts.map(({ name, type, currency, openingBalance }) => ({
        id: idOf(accountIds, name, 'account'),
        userId: user.id,
        name,
        type,
        currency,
        openingBalance,
      })),
    })
    await tx.category.createMany({
      data: ledger.categories.map((name) => ({ id: idOf(categoryIds, name, 'category'), userId: user.id, name })),
    })

    // A transfer is its two sides in one statement, with one amount, day and note for both.
    const rows: Prisma.TransactionCreateManyInput[] = [
      ...ledger.entries.map(({ account, category, type, amount, date, note }) => ({
        accountId: idOf(accountIds, account, 'account'),
        categoryId: category === null ? null : idOf(categoryIds, category, 'category'),
        type: type === 'income' ? TransactionType.income : TransactionType.expense,
        amount,
        date: parseIsoDate(date),
        note,
      })),
      ...ledger.transfers.flatMap(({ from, to, amount, date, note }) => {
        const side = {
          type: TransactionType.transfer,
          transferPairId: randomUUID(),
          amount,
          date: parseIsoDate(date),
          note,
        }

        return [
          { ...side, accountId: idOf(accountIds, from, 'account'), transferDirection: TransferDirection.out },
          { ...side, accountId: idOf(accountIds, to, 'account'), transferDirection: TransferDirection.in },
        ]
      }),
    ]

    await tx.transaction.createMany({ data: rows })

    return {
      userId: user.id,
      from: ledger.from,
      today,
      accounts: ledger.accounts.length,
      categories: ledger.categories.length,
      transactions: rows.length,
      transfers: ledger.transfers.length,
      removed: { accounts, categories, transactions },
    }
  })
}
