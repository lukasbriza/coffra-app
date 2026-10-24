import type { OwnerScope } from '../../core'
import type { Account, Transaction, TransactionType, TransferDirection } from '../../prisma'

import type { LIST_ORDERS } from './constants'

/** The types of a transaction this API creates and changes; a transfer has an API of its own. */
export type IncomeExpenseType = Exclude<TransactionType, 'transfer'>

/**
 * What the API returns for a transaction, a side of a transfer included: no timestamps.
 *
 * `amount` is always positive, the sign comes from `type` and, for a transfer, `transferDirection`.
 *
 * @property id - id of the transaction (UUID)
 * @property accountId - the account the transaction is on
 * @property type - income, expense or transfer
 * @property amount - decimal string with four decimal places, in the currency of the account, e.g. `"1250.5000"`
 * @property date - calendar day `YYYY-MM-DD`
 * @property note - free text, `null` for none
 * @property categoryId - the category, `null` for none; a transfer has none
 * @property transferPairId - shared by both sides of a transfer, `null` otherwise
 * @property transferDirection - `out` on the source account of a transfer, `in` on the target, `null` otherwise
 */
export type TransactionView = {
  id: string
  accountId: string
  type: TransactionType
  amount: string
  date: string
  note: string | null
  categoryId: string | null
  transferPairId: string | null
  transferDirection: TransferDirection | null
}

/**
 * Input of recording an income or an expense.
 *
 * @property accountId - the account the transaction is on
 * @property type - income or expense
 * @property amount - positive decimal string
 * @property date - calendar day `YYYY-MM-DD`
 * @property categoryId - the category; `null` or left out for none
 * @property note - free text; `null` or left out for none
 */
export type CreateTransactionInput = {
  accountId: string
  type: IncomeExpenseType
  amount: string
  date: string
  categoryId?: string | null
  note?: string | null
}

/** Input of changing a transaction: any field of a create; `null` clears the category or the note. */
export type UpdateTransactionInput = Partial<CreateTransactionInput>

/**
 * The account and the category an input points to, each left out when the input does not point to one.
 *
 * @property accountId - the account to check
 * @property categoryId - the category to check; `null` means none, so there is nothing to check
 */
export type TransactionReferences = {
  accountId?: string | undefined
  categoryId?: string | null | undefined
}

/** A transaction row read with the currency of its account, which a move to another account must keep. */
export type OwnedTransaction = Transaction & { account: Pick<Account, 'currency'> }

/**
 * Prisma `where` fragment of a write: the owner scope through the account, income or expense only.
 *
 * @property account - the owner scope through the account of the transaction
 * @property type - income or expense; a side of a transfer is never written through this API
 */
export type EditableScope = {
  account: OwnerScope
  type: { in: IncomeExpenseType[] }
}

/** The direction of the list over its sort key `(date, createdAt, id)`. */
export type ListOrder = (typeof LIST_ORDERS)[number]

/**
 * A position in the list: the sort key of the last row of a page, and the order it was issued for.
 *
 * It is the sort key of a row, not a reference to it: nothing is ever looked up by its `id`, so a deleted row still
 * marks a position, and an id of another owner reveals nothing. It is not signed: a changed cursor only moves the
 * position within the rows of the owner, whose scope is in every query.
 *
 * @property order - the order the cursor was issued for
 * @property date - calendar day `YYYY-MM-DD`
 * @property createdAt - ISO timestamp in UTC with milliseconds, e.g. `2026-10-19T08:00:00.123Z`
 * @property id - id of the row, the last key that makes the order total
 */
export type ListCursor = {
  order: ListOrder
  date: string
  createdAt: string
  id: string
}

/**
 * The filters and the position of a list; a filter left out matches every row.
 *
 * @property accountId - only the transactions of this account
 * @property categoryId - only the transactions of this category
 * @property type - only the transactions of this type
 * @property from - first day, inclusive, `YYYY-MM-DD`
 * @property to - last day, inclusive, `YYYY-MM-DD`
 * @property order - the direction of the list
 * @property limit - most transactions on the page
 * @property cursor - the position of the page; left out for the first page
 */
export type ListTransactionsInput = {
  accountId?: string
  categoryId?: string
  type?: TransactionType
  from?: string
  to?: string
  order: ListOrder
  limit: number
  cursor?: ListCursor
}

/**
 * One page of the list, in the requested order.
 *
 * @property items - the transactions of the page
 * @property nextCursor - the `cursor` of the next page; `null` on the last one
 */
export type TransactionPage = {
  items: TransactionView[]
  nextCursor: string | null
}

/**
 * Prisma filter of the `date` column for a range of days, each end left out when the range is open there.
 *
 * @property gte - first day, inclusive
 * @property lte - last day, inclusive
 */
export type DateRange = {
  gte?: Date
  lte?: Date
}
