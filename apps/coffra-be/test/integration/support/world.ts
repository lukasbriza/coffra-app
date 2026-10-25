import { randomUUID } from 'node:crypto'

import { type PrismaService, TransactionType, TransferDirection } from '../../../src/modules/prisma'
import { parseIsoDate } from '../../../src/utils'

// The data every integration spec starts from: two users who own the same structure, written straight through Prisma
// (no HTTP). The amounts of `b` are a thousand times those of `a`, so a row of `b` that leaked into a list or a
// balance of `a` cannot go unnoticed.

/** Amounts of one user, as the API spells them (four decimal places) where it returns them. */
type Amounts = {
  mainOpening: string
  euroOpening: string
  emptyOpening: string
  income: string
  expense: string
  transfer: string
  /** The balance of every account with all of the above, as `GET /api/accounts` returns it. */
  balances: Record<keyof Persona['accounts'], string>
}

const AMOUNTS: Record<'a' | 'b', Amounts> = {
  a: {
    mainOpening: '1000',
    euroOpening: '50',
    emptyOpening: '42',
    income: '2500',
    expense: '300.25',
    transfer: '400',
    balances: { main: '2799.7500', savings: '400.0000', euro: '50.0000', empty: '42.0000' },
  },
  b: {
    mainOpening: '1000000',
    euroOpening: '50000',
    emptyOpening: '42000',
    income: '2500000',
    expense: '300250',
    transfer: '400000',
    balances: { main: '2799750.0000', savings: '400000.0000', euro: '50000.0000', empty: '42000.0000' },
  },
}

/** The days of the seeded transactions, all in the past, so every balance of today counts them. */
export const SEED_DAYS = { income: '2026-01-10', expense: '2026-01-12', transfer: '2026-01-15' } as const

/** What one user owns at the start of every spec, by id, and a valid access token of that user. */
export type Persona = {
  userId: string
  token: string
  /** `main` (CZK, has every transaction), `savings` (CZK, receives the transfer), `euro` (EUR), `empty` (CZK, none). */
  accounts: { main: string; savings: string; euro: string; empty: string }
  /** `food` (the expense), `salary` (the income), `unused` (no transaction). Both users have the same names. */
  categories: { food: string; salary: string; unused: string }
  /** The income (`salary`) and the expense (`food`) on `main`. */
  transactions: { income: string; expense: string }
  /** The transfer `main` → `savings`: the pair id and the ids of its two sides. */
  transfer: { pairId: string; out: string; in: string }
  /** The balance of every account, as the API returns it. */
  balances: Amounts['balances']
}

/** The two users of a spec. */
export type World = { a: Persona; b: Persona }

/**
 * Writes the data of one user, the way the services would have written it (a transfer is two rows sharing a pair id,
 * an `out` and an `in`; the CHECK constraints of the schema refuse any other shape).
 *
 * @param prisma - the client of the app under test
 * @param issueToken - gives an access token for a user id
 * @param label - `a` or `b`
 * @returns the ids of what was written
 */
const seedPersona = async (
  prisma: PrismaService,
  issueToken: (userId: string) => Promise<string>,
  label: 'a' | 'b',
): Promise<Persona> => {
  const amounts = AMOUNTS[label]
  const user = await prisma.user.create({ data: { email: `${label}@coffra.test`, externalSubject: randomUUID() } })
  const accounts = { main: randomUUID(), savings: randomUUID(), euro: randomUUID(), empty: randomUUID() }
  const categories = { food: randomUUID(), salary: randomUUID(), unused: randomUUID() }
  const transactions = { income: randomUUID(), expense: randomUUID() }
  const transfer = { pairId: randomUUID(), out: randomUUID(), in: randomUUID() }

  await prisma.account.createMany({
    data: [
      {
        id: accounts.main,
        userId: user.id,
        name: 'Main',
        type: 'bank',
        currency: 'CZK',
        openingBalance: amounts.mainOpening,
      },
      { id: accounts.savings, userId: user.id, name: 'Savings', type: 'bank', currency: 'CZK' },
      {
        id: accounts.euro,
        userId: user.id,
        name: 'Euro',
        type: 'bank',
        currency: 'EUR',
        openingBalance: amounts.euroOpening,
      },
      {
        id: accounts.empty,
        userId: user.id,
        name: 'Wallet',
        type: 'cash',
        currency: 'CZK',
        openingBalance: amounts.emptyOpening,
      },
    ],
  })
  await prisma.category.createMany({
    data: [
      { id: categories.food, userId: user.id, name: 'Food' },
      { id: categories.salary, userId: user.id, name: 'Salary' },
      { id: categories.unused, userId: user.id, name: 'Unused' },
    ],
  })

  const transferSide = { type: TransactionType.transfer, transferPairId: transfer.pairId, amount: amounts.transfer }
  const transferDay = parseIsoDate(SEED_DAYS.transfer)

  await prisma.transaction.createMany({
    data: [
      {
        id: transactions.income,
        accountId: accounts.main,
        type: TransactionType.income,
        amount: amounts.income,
        date: parseIsoDate(SEED_DAYS.income),
        categoryId: categories.salary,
      },
      {
        id: transactions.expense,
        accountId: accounts.main,
        type: TransactionType.expense,
        amount: amounts.expense,
        date: parseIsoDate(SEED_DAYS.expense),
        categoryId: categories.food,
        note: 'Groceries',
      },
      {
        ...transferSide,
        id: transfer.out,
        accountId: accounts.main,
        transferDirection: TransferDirection.out,
        date: transferDay,
      },
      {
        ...transferSide,
        id: transfer.in,
        accountId: accounts.savings,
        transferDirection: TransferDirection.in,
        date: transferDay,
      },
    ],
  })

  return {
    userId: user.id,
    token: await issueToken(user.id),
    accounts,
    categories,
    transactions,
    transfer,
    balances: amounts.balances,
  }
}

/**
 * Writes the data of both users into the (empty) database.
 *
 * @param prisma - the client of the app under test
 * @param issueToken - gives an access token for a user id
 * @returns both users
 */
export const seedWorld = async (
  prisma: PrismaService,
  issueToken: (userId: string) => Promise<string>,
): Promise<World> => ({
  a: await seedPersona(prisma, issueToken, 'a'),
  b: await seedPersona(prisma, issueToken, 'b'),
})

/**
 * Every id a user owns, of one kind.
 *
 * @param group - one group of ids of a persona (`accounts`, `categories`, ...)
 * @returns the ids, sorted
 */
export const ownIds = (group: Record<string, string>): string[] => Object.values(group).toSorted()

/**
 * The ids in a response body, sorted.
 *
 * @param body - a list from the API (`response.body`, untyped)
 * @returns the `id` of every item, sorted
 */
export const idsOf = (body: unknown): string[] => (body as { id: string }[]).map(({ id }) => id).toSorted()
