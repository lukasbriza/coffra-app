import { randomUUID } from 'node:crypto'

import { Prisma, type PrismaService, TransactionType, TransferDirection } from '../../../src/modules/prisma'
import { parseIsoDate } from '../../../src/utils'

import type { Persona } from './world'

// Data for the specs of the dashboard: a ledger big enough to hold every kind of row in every month of several years
// (the independent SQL needs something to disagree about), and a few helpers to write the handful of rows a spec with
// numbers written by hand needs. Written straight through Prisma, like `seedWorld`.

/** A row the spec chooses: an income or an expense of the account with this id. */
export type Row = {
  accountId: string
  type: 'income' | 'expense'
  amount: string
  date: string
  categoryId?: string | null
}

/** How a ledger is made: the seed of its pseudo-random part and the factor of every amount. */
export type LedgerOptions = { seed: number; scale: number }

/** What a persona owns after `seedLedger`: its own accounts and categories plus those the ledger added. */
export type Ledger = {
  accounts: Persona['accounts'] & { dollars: string; euroSpare: string }
  categories: Persona['categories'] & { rent: string; fun: string; health: string; abel: string }
}

/** The pseudo-random part of the ledger lies between these days, both inclusive. */
const RANDOM_FIRST_DAY = Date.UTC(2024, 0, 1)
const RANDOM_DAYS = 2008 // 2024-01-01 .. 2029-06-30
const RANDOM_ROWS = 1500

/** The first and the last day of every month from January 2024 to December 2029 get a row of their own. */
const EDGE_FIRST_YEAR = 2024
const EDGE_YEARS = 6

const CHUNK = 500
const MODULUS = 2_147_483_647
const MULTIPLIER = 48_271

/**
 * A small deterministic generator (Park–Miller): the same seed gives the same ledger on every machine and run.
 *
 * @param seed - any positive integer
 * @returns a function giving numbers in `[0, 1)`
 */
const generator = (seed: number): (() => number) => {
  let state = seed % MODULUS || 1

  return () => {
    state = (state * MULTIPLIER) % MODULUS

    return (state - 1) / (MODULUS - 1)
  }
}

/**
 * `YYYY-MM-DD` of a day given as milliseconds since the epoch, in UTC.
 *
 * @param ms - a UTC midnight
 * @returns the day
 */
const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10)

/**
 * An amount as the API takes it, from a number of ten-thousandths.
 *
 * @param tenThousandths - a positive whole number
 * @returns a decimal string with four decimal places
 */
const amountOf = (tenThousandths: number): string => {
  const padded = String(tenThousandths).padStart(5, '0')

  return `${padded.slice(0, -4)}.${padded.slice(-4)}`
}

/**
 * Writes rows in chunks, so one statement never meets the limit on the number of parameters.
 *
 * @param prisma - the client of the app under test
 * @param data - the rows
 */
const writeInChunks = async (prisma: PrismaService, data: Prisma.TransactionCreateManyInput[]): Promise<void> => {
  for (let from = 0; from < data.length; from += CHUNK) {
    await prisma.transaction.createMany({ data: data.slice(from, from + CHUNK) })
  }
}

/**
 * Gives a persona a ledger: a USD account and a second EUR account, four more categories and about 1 650 income,
 * expense and transfer rows spread over 2024 to mid 2029, so any window of the dashboard holds a few dozen of them.
 *
 * Every month of those years has a row on its first and on its last day (the days a month can slip over). The rest is
 * pseudo-random from `seed`: about a tenth of the rows are transfers, about one in seven has no category, a few are
 * `0.0001`. The seed of the world (January 2026) stays, so the ledger adds to it. Rows dated after the clock of a spec
 * are the planned payments.
 *
 * @param prisma - the client of the app under test
 * @param persona - whose ledger
 * @param options - the seed and the factor of the amounts (`1000` for the second user, so a leak is loud)
 * @returns every account and category the persona owns, by name
 */
export const seedLedger = async (
  prisma: PrismaService,
  persona: Persona,
  { seed, scale }: LedgerOptions,
): Promise<Ledger> => {
  const random = generator(seed)
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)]

  const accounts = { ...persona.accounts, dollars: randomUUID(), euroSpare: randomUUID() }
  const categories = {
    ...persona.categories,
    rent: randomUUID(),
    fun: randomUUID(),
    health: randomUUID(),
    abel: randomUUID(),
  }

  await prisma.account.createMany({
    data: [
      { id: accounts.dollars, userId: persona.userId, name: 'Dollars', type: 'bank', currency: 'USD' },
      { id: accounts.euroSpare, userId: persona.userId, name: 'Euro spare', type: 'bank', currency: 'EUR' },
    ],
  })
  await prisma.category.createMany({
    data: [
      { id: categories.rent, userId: persona.userId, name: 'Rent' },
      { id: categories.fun, userId: persona.userId, name: 'Zábava' },
      { id: categories.health, userId: persona.userId, name: 'zdraví' },
      { id: categories.abel, userId: persona.userId, name: 'Ábel' },
    ],
  })

  const spendable = [
    accounts.main,
    accounts.savings,
    accounts.empty,
    accounts.euro,
    accounts.euroSpare,
    accounts.dollars,
  ]
  // The sides of a transfer share a currency, and USD has one account only, so it has no transfers.
  const transferPairs = [
    [accounts.main, accounts.savings],
    [accounts.savings, accounts.empty],
    [accounts.empty, accounts.main],
    [accounts.euro, accounts.euroSpare],
  ] as const
  const labelled = [
    categories.food,
    categories.salary,
    categories.unused,
    categories.rent,
    categories.fun,
    categories.health,
    categories.abel,
  ]

  // An amount between `0.0001` and `500.0000` (times the factor); one in thirty is the smallest there is.
  const randomAmount = (): string =>
    amountOf(random() < 1 / 30 ? scale : (1 + Math.floor(random() * 5_000_000)) * scale)

  const data: Prisma.TransactionCreateManyInput[] = []
  const add = (accountId: string, type: 'income' | 'expense', day: string, categoryId: string | null): void => {
    data.push({
      accountId,
      type: type === 'income' ? TransactionType.income : TransactionType.expense,
      amount: randomAmount(),
      date: parseIsoDate(day),
      categoryId,
    })
  }
  const addTransfer = (day: string): void => {
    const [from, to] = pick(transferPairs)
    const transfer = { type: TransactionType.transfer, transferPairId: randomUUID(), amount: randomAmount() }
    const date = parseIsoDate(day)

    data.push(
      { ...transfer, accountId: from, transferDirection: TransferDirection.out, date },
      { ...transfer, accountId: to, transferDirection: TransferDirection.in, date },
    )
  }

  // The edges of every month: the days a month can slip over, one row each, on rotating accounts and categories.
  let turn = 0
  for (let year = EDGE_FIRST_YEAR; year < EDGE_FIRST_YEAR + EDGE_YEARS; year += 1) {
    for (let month = 0; month < 12; month += 1) {
      for (const day of [dayOf(Date.UTC(year, month, 1)), dayOf(Date.UTC(year, month + 1, 0))]) {
        add(
          spendable[turn % spendable.length],
          turn % 3 === 0 ? 'expense' : 'income',
          day,
          labelled[turn % labelled.length],
        )
        turn += 1
      }
    }
  }

  // The rest: random days, accounts, kinds and categories.
  for (let row = 0; row < RANDOM_ROWS; row += 1) {
    const day = dayOf(RANDOM_FIRST_DAY + Math.floor(random() * RANDOM_DAYS) * 86_400_000)
    const kind = random()

    if (kind < 0.1) {
      addTransfer(day)
    } else {
      add(pick(spendable), kind < 0.55 ? 'expense' : 'income', day, random() < 1 / 7 ? null : pick(labelled))
    }
  }

  await writeInChunks(prisma, data)

  return { accounts, categories }
}

/**
 * Removes every transaction of every user (accounts and categories stay), so the few rows of a spec with numbers
 * written by hand are all there is.
 *
 * @param prisma - the client of the app under test
 */
export const clearTransactions = async (prisma: PrismaService): Promise<void> => {
  await prisma.transaction.deleteMany()
}

/**
 * Writes income and expense rows chosen by the spec.
 *
 * @param prisma - the client of the app under test
 * @param rows - what to write; a row without `categoryId` has no category
 */
export const writeRows = async (prisma: PrismaService, rows: Row[]): Promise<void> => {
  await writeInChunks(
    prisma,
    rows.map(({ accountId, type, amount, date, categoryId = null }) => ({
      accountId,
      type: type === 'income' ? TransactionType.income : TransactionType.expense,
      amount,
      date: parseIsoDate(date),
      categoryId,
    })),
  )
}
