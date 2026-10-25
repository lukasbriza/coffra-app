import { TransactionType } from '../../prisma'

/** The types this API creates and changes. A transfer is a pair of rows with an API of its own. */
export const INCOME_EXPENSE_TYPES = [TransactionType.income, TransactionType.expense] as const

/** The directions of the list: `desc` (the newest first, the default) and `asc`. */
export const LIST_ORDERS = ['desc', 'asc'] as const

/** Transactions on a page of the list when the request does not say. */
export const DEFAULT_LIST_LIMIT = 50

/** Most transactions on one page of the list. */
export const MAX_LIST_LIMIT = 100

/** Longest cursor accepted; one the list issues is about 160 characters. */
export const LIST_CURSOR_MAX_LENGTH = 256

/** The alphabet of a cursor: base64url, without padding, as `encodeListCursor` writes it. */
export const LIST_CURSOR_PATTERN = /^[\w-]+$/
