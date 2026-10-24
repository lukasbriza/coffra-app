import { Buffer } from 'node:buffer'

import { isUUID } from 'class-validator'

import { formatIsoDate } from '../../../utils'
import type { Transaction } from '../../prisma'
import { isIsoDate } from '../common/decorators/is-iso-date.decorator'

import { LIST_CURSOR_MAX_LENGTH, LIST_CURSOR_PATTERN, LIST_ORDERS } from './constants'
import type { ListCursor, ListOrder } from './transactions.types'

/**
 * Tells whether a value is one of the orders of the list.
 *
 * @param value - anything
 * @returns `true` for `desc` and `asc`, which narrows `value` to `ListOrder`
 */
const isListOrder = (value: unknown): value is ListOrder => LIST_ORDERS.includes(value as ListOrder)

/**
 * Tells whether a value is a timestamp in the one spelling `toISOString()` gives: UTC, with milliseconds.
 *
 * @param value - anything
 * @returns `true` for such a timestamp, which narrows `value` to `string`
 */
const isTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value

/**
 * Encodes the position after a row in a list of the given order: base64url JSON, safe in a URL as it is.
 *
 * @param row - the last row of the page; only its sort key is read
 * @param order - the order the list is read in
 * @returns the cursor
 */
export const encodeListCursor = (
  { date, createdAt, id }: Pick<Transaction, 'date' | 'createdAt' | 'id'>,
  order: ListOrder,
): string => {
  const cursor: ListCursor = { order, date: formatIsoDate(date), createdAt: createdAt.toISOString(), id }

  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

/**
 * Tells whether a value is a decoded cursor: exactly its four keys, each of the shape `encodeListCursor` writes.
 *
 * @param value - anything
 * @returns `true` for a cursor, which narrows `value` to `ListCursor`
 */
export const isListCursor = (value: unknown): value is ListCursor => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const { order, date, createdAt, id, ...rest } = value as Record<string, unknown>

  return (
    Object.keys(rest).length === 0 &&
    isListOrder(order) &&
    isIsoDate(date) &&
    isTimestamp(createdAt) &&
    typeof id === 'string' &&
    isUUID(id)
  )
}

/**
 * Decodes a cursor made by `encodeListCursor`.
 *
 * @param value - the cursor as it came in the query string
 * @returns the position, or `undefined` for anything else: too long, not base64url, not JSON, a key missing or one too
 * many, a value of the wrong shape
 */
export const decodeListCursor = (value: unknown): ListCursor | undefined => {
  if (typeof value !== 'string' || value.length > LIST_CURSOR_MAX_LENGTH || !LIST_CURSOR_PATTERN.test(value)) {
    return undefined
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
  } catch {
    return undefined
  }

  return isListCursor(parsed) ? parsed : undefined
}
