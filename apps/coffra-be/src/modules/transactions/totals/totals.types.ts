import type { Prisma, TransactionType } from '../../prisma'

/**
 * A range of calendar days.
 *
 * @property from - first day, `YYYY-MM-DD`, inclusive
 * @property to - last day, `YYYY-MM-DD`, inclusive; a range whose `from` is after `to` holds no transaction
 */
export type TotalsRange = {
  from: string
  to: string
}

/**
 * A category as the owner has it.
 *
 * @property id - id of the category (UUID)
 * @property name - name given by the owner; unique per owner and case-sensitive
 */
export type TotalsCategory = {
  id: string
  name: string
}

/**
 * Income and expense of one category in one currency, over a range of days.
 *
 * Every amount is a positive `Prisma.Decimal` of 40 significant digits (`Money`), `0` for the side that has no
 * transaction. The precision belongs to the value: `income.plus(expense)` stays exact, but a sum that starts from
 * `new Prisma.Decimal(0)` rounds to 20 digits. Start from one of these values.
 *
 * @property currency - three capital letters; the currency of the accounts the transactions are on, never converted
 * @property category - the category, or `null` for the transactions that have none
 * @property income - sum of the income, in `currency`
 * @property expense - sum of the expense, in `currency`
 */
export type CategoryTotal = {
  currency: string
  category: TotalsCategory | null
  income: Prisma.Decimal
  expense: Prisma.Decimal
}

/**
 * Income and expense of one currency on one calendar day.
 *
 * Every amount is a positive `Prisma.Decimal` of 40 significant digits (`Money`), `0` for the side that has no
 * transaction, with the same rule about sums as {@link CategoryTotal}: start from one of these values.
 *
 * @property currency - three capital letters; the currency of the accounts the transactions are on, never converted
 * @property date - the day, `YYYY-MM-DD`
 * @property income - sum of the income of the day, in `currency`
 * @property expense - sum of the expense of the day, in `currency`
 */
export type DayTotal = {
  currency: string
  date: string
  income: Prisma.Decimal
  expense: Prisma.Decimal
}

/**
 * The sum of the amounts of one kind of transaction of one account in one category, as the database grouped them.
 *
 * @property accountId - id of the account
 * @property categoryId - id of the category; `null` for transactions without one
 * @property type - kind of the grouped transactions
 * @property total - sum of the amounts, which are always positive
 */
export type GroupedTotal = {
  accountId: string
  categoryId: string | null
  type: TransactionType
  total: Prisma.Decimal
}

/**
 * The sum of the amounts of one kind of transaction of one account on one day, as the database grouped them.
 *
 * @property accountId - id of the account
 * @property date - the day, `YYYY-MM-DD`
 * @property type - kind of the grouped transactions
 * @property total - sum of the amounts, which are always positive
 */
export type DailyGroupedTotal = {
  accountId: string
  date: string
  type: TransactionType
  total: Prisma.Decimal
}
