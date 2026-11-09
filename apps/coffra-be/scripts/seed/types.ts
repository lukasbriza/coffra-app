import type { PrismaClient } from '../../src/modules/prisma/generated/client'

/**
 * What the seed needs from the database client: transactions and nothing else, so a spec can wrap it and make a write
 * fail. `PrismaClient` and `PrismaService` both fit.
 */
export type SeedClient = Pick<PrismaClient, '$transaction'>

/**
 * A calendar month.
 *
 * @property year - the year, e.g. `2026`
 * @property month - the month, `1` to `12`
 */
export type YearMonth = {
  year: number
  month: number
}

/**
 * An account of the demo user. Referred to by its name, which is unique within a ledger.
 *
 * @property name - name of the account
 * @property type - kind of account
 * @property currency - ISO 4217 code, fixed for the account
 * @property openingBalance - balance before the first transaction, a decimal string with four decimal places
 */
export type LedgerAccount = {
  name: string
  type: 'bank' | 'cash'
  currency: string
  openingBalance: string
}

/**
 * An income or an expense, written once.
 *
 * @property account - name of the account
 * @property category - name of the category, `null` for a transaction without one
 * @property type - income or expense
 * @property amount - positive decimal string with four decimal places
 * @property date - the day, `YYYY-MM-DD`
 * @property note - free text
 */
export type LedgerEntry = {
  account: string
  category: string | null
  type: 'income' | 'expense'
  amount: string
  date: string
  note: string
}

/**
 * A transfer between two accounts of the same currency, one item for both of its sides: the amount, the day and the
 * note exist once, so the two rows written from it cannot differ.
 *
 * @property from - name of the account the money leaves
 * @property to - name of the account the money arrives to
 * @property amount - positive decimal string with four decimal places
 * @property date - the day, `YYYY-MM-DD`
 * @property note - free text
 */
export type LedgerTransfer = {
  from: string
  to: string
  amount: string
  date: string
  note: string
}

/**
 * Everything the seed writes for one day, with accounts and categories referred to by name.
 *
 * @property from - the first day of the oldest month
 * @property accounts - the accounts
 * @property categories - names of the categories
 * @property entries - the incomes and expenses
 * @property transfers - the transfers
 */
export type Ledger = {
  from: string
  accounts: readonly LedgerAccount[]
  categories: readonly string[]
  entries: LedgerEntry[]
  transfers: LedgerTransfer[]
}

/**
 * An entry that repeats every month.
 *
 * @property account - name of the account
 * @property category - name of the category, `null` for none
 * @property type - income or expense
 * @property day - day of the month, 1 to 28 so every month has it
 * @property note - free text
 * @property amount - whole amount of the month with the given index (`0` is the oldest month of the window)
 * @property when - months that have the entry; every month when left out
 */
export type RecurringEntry = {
  account: string
  category: string | null
  type: 'income' | 'expense'
  day: number
  note: string
  amount: (index: number) => number
  when?: (index: number) => boolean
}

/**
 * A transfer that repeats every month.
 *
 * @property from - name of the account the money leaves
 * @property to - name of the account the money arrives to
 * @property day - day of the month, 1 to 28
 * @property amount - whole amount
 * @property note - free text
 */
export type RecurringTransfer = {
  from: string
  to: string
  day: number
  amount: number
  note: string
}

/**
 * The planned payment: an expense dated after today, which the balance of today does not count yet.
 *
 * @property account - name of the account
 * @property category - name of the category
 * @property amount - whole amount
 * @property note - free text
 */
export type PlannedEntry = {
  account: string
  category: string
  amount: number
  note: string
}

/**
 * What a seed run did.
 *
 * @property userId - id of the demo user
 * @property from - the first day of the oldest month written
 * @property today - the day the data was made for
 * @property accounts - accounts written
 * @property categories - categories written
 * @property transactions - rows written, both sides of a transfer counted
 * @property transfers - transfers among them
 * @property removed - what the demo user had before and the seed replaced
 */
export type SeedSummary = {
  userId: string
  from: string
  today: string
  accounts: number
  categories: number
  transactions: number
  transfers: number
  removed: { accounts: number; categories: number; transactions: number }
}
