import type { OwnerScope } from '../../core'
import type { Account, Transaction, TransactionType, TransferDirection } from '../../prisma'

import type { LIST_ORDERS } from './constants'

/** The types of a transaction this API creates and changes; a transfer has an API of its own. */
export type IncomeExpenseType = Exclude<TransactionType, 'transfer'>

/**
 * What the API returns for a transaction, a side of a transfer included: no timestamps. `amount` is always positive,
 * the sign comes from `type` and, for a transfer, `transferDirection`.
 */
export type TransactionView = {
  id: string
  accountId: string
  type: TransactionType
  /** Decimal string with four decimal places, in the currency of the account, e.g. `"1250.5000"`. */
  amount: string
  /** Calendar day `YYYY-MM-DD`. */
  date: string
  note: string | null
  categoryId: string | null
  /** Shared by both sides of a transfer, `null` otherwise. */
  transferPairId: string | null
  /** `out` on the source account of a transfer, `in` on the target, `null` otherwise. */
  transferDirection: TransferDirection | null
}

export type CreateTransactionInput = {
  accountId: string
  type: IncomeExpenseType
  /** Positive decimal string. */
  amount: string
  /** Calendar day `YYYY-MM-DD`. */
  date: string
  /** `null` or left out: no category. */
  categoryId?: string | null
  /** `null` or left out: no note. */
  note?: string | null
}

/** Any field of a create; `null` clears the category or the note. */
export type UpdateTransactionInput = Partial<CreateTransactionInput>

/** The account and the category an input points to, each left out when the input does not point to one. */
export type TransactionReferences = {
  accountId?: string | undefined
  categoryId?: string | null | undefined
}

/** A transaction row read with the currency of its account, which a move to another account must keep. */
export type OwnedTransaction = Transaction & { account: Pick<Account, 'currency'> }

/** Prisma `where` fragment of a write: the owner scope through the account, income or expense only. */
export type EditableScope = {
  account: OwnerScope
  type: { in: IncomeExpenseType[] }
}

/** The direction of the list over its sort key `(date, createdAt, id)`. */
export type ListOrder = (typeof LIST_ORDERS)[number]

/** A position in the list: the sort key of the last row of a page, and the order it was issued for. */
export type ListCursor = {
  order: ListOrder
  /** Calendar day `YYYY-MM-DD`. */
  date: string
  /** ISO timestamp in UTC with milliseconds, e.g. `2026-10-19T08:00:00.123Z`. */
  createdAt: string
  id: string
}

/** The filters and the position of a list; a filter left out matches every row. */
export type ListTransactionsInput = {
  accountId?: string
  categoryId?: string
  type?: TransactionType
  /** First day, inclusive, `YYYY-MM-DD`. */
  from?: string
  /** Last day, inclusive, `YYYY-MM-DD`. */
  to?: string
  order: ListOrder
  /** Most transactions on the page. */
  limit: number
  /** Left out: the first page. */
  cursor?: ListCursor
}

/** One page of the list, in the requested order. */
export type TransactionPage = {
  items: TransactionView[]
  /** The `cursor` of the next page; `null` on the last one. */
  nextCursor: string | null
}

/** Prisma filter of the `date` column for a range of days, each end left out when the range is open there. */
export type DateRange = {
  gte?: Date
  lte?: Date
}
