import { Buffer } from 'node:buffer'

import { isUUID } from 'class-validator'

import { formatIsoDate } from '../../../utils'
import type { Transaction } from '../../prisma'
import { isIsoDate } from '../common/decorators/is-iso-date.decorator'

import { LIST_CURSOR_MAX_LENGTH, LIST_CURSOR_PATTERN, LIST_ORDERS } from './constants'
import type { ListCursor, ListOrder } from './transactions.types'

// The cursor is the sort key of a row, not a reference to it: nothing is ever looked up by its `id`, so a deleted row
// still marks a position, and an id of another owner reveals nothing. It is not signed: a changed cursor only moves the
// position within the rows of the owner, whose scope is in every query.

const isListOrder = (value: unknown): value is ListOrder => LIST_ORDERS.includes(value as ListOrder)

// Only the spelling `toISOString()` gives: UTC, with milliseconds.
const isTimestamp = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value

/** The cursor of the position after `row` in a list of `order`: base64url JSON, safe in a URL as it is. */
export const encodeListCursor = (
  { date, createdAt, id }: Pick<Transaction, 'date' | 'createdAt' | 'id'>,
  order: ListOrder,
): string => {
  const cursor: ListCursor = { order, date: formatIsoDate(date), createdAt: createdAt.toISOString(), id }

  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

/** Whether `value` is a decoded cursor: exactly its four keys, each of the shape `encodeListCursor` writes. */
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
 * The position a cursor of `encodeListCursor` stands for, or `undefined` for anything else: too long, not base64url,
 * not JSON, a key missing or one too many, a value of the wrong shape.
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
