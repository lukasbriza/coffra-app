import { describe, expect, it } from 'vitest'

import { LIST_CURSOR_MAX_LENGTH } from '../../../../src/modules/transactions/transactions/constants'
import {
  decodeListCursor,
  encodeListCursor,
  isListCursor,
} from '../../../../src/modules/transactions/transactions/transactions.cursor'
import { TIME_ZONES, useTimeZone } from '../../../utils/use-time-zone'

const ID = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d'

/** The sort key of a row as Prisma returns it. */
const KEY = { date: new Date('2026-10-19T00:00:00.000Z'), createdAt: new Date('2026-10-19T08:00:00.123Z'), id: ID }

/** What the cursor of `KEY` in a `desc` list stands for. */
const POSITION = { order: 'desc', date: '2026-10-19', createdAt: '2026-10-19T08:00:00.123Z', id: ID }

/** Any JSON as a cursor would carry it, for the shapes `encodeListCursor` never writes. */
const raw = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url')

describe('encodeListCursor', () => {
  it('decodes back to the sort key of the row and the order of the list', () => {
    expect(decodeListCursor(encodeListCursor(KEY, 'desc'))).toStrictEqual(POSITION)
    expect(decodeListCursor(encodeListCursor(KEY, 'asc'))).toStrictEqual({ ...POSITION, order: 'asc' })
  })

  it('writes base64url, safe in a query string without escaping', () => {
    const cursor = encodeListCursor(KEY, 'desc')

    expect(cursor).toMatch(/^[\w-]+$/)
    expect(encodeURIComponent(cursor)).toBe(cursor)
  })

  it('stays well within the accepted length, with the longest values it writes', () => {
    const cursor = encodeListCursor(
      {
        date: new Date('9999-12-31T00:00:00.000Z'),
        createdAt: new Date('9999-12-31T23:59:59.999Z'),
        id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      },
      'desc',
    )

    expect(cursor.length).toBeLessThan(LIST_CURSOR_MAX_LENGTH)
  })

  describe.each(TIME_ZONES)('in the time zone %s', (zone, offset) => {
    useTimeZone(zone, offset)

    it('writes the day and the timestamp in UTC: the same cursor as on a server in UTC', () => {
      expect(encodeListCursor(KEY, 'desc')).toBe(raw(POSITION))
      expect(decodeListCursor(encodeListCursor(KEY, 'desc'))).toStrictEqual(POSITION)
    })
  })
})

describe('decodeListCursor', () => {
  it.each([
    ['a number', 42],
    ['a list, as a repeated parameter arrives', [raw(POSITION), raw(POSITION)]],
    ['the empty string', ''],
    ['a string that is no base64url', `${raw(POSITION)}+/`],
    ['base64url padding', `${raw(POSITION)}=`],
    ['base64url that is no JSON', Buffer.from('not json').toString('base64url')],
    ['a JSON string', raw('desc')],
    ['a JSON list', raw(Object.values(POSITION))],
    ['JSON null', raw(null)],
    ['a missing key', raw({ order: 'desc', date: '2026-10-19', createdAt: '2026-10-19T08:00:00.123Z' })],
    ['one key too many', raw({ ...POSITION, userId: ID })],
    ['an order in capitals', raw({ ...POSITION, order: 'DESC' })],
    ['an unknown order', raw({ ...POSITION, order: 'up' })],
    ['a day that does not exist', raw({ ...POSITION, date: '2026-02-30' })],
    ['a day with a time', raw({ ...POSITION, date: '2026-10-19T00:00:00Z' })],
    ['a timestamp without milliseconds', raw({ ...POSITION, createdAt: '2026-10-19T08:00:00Z' })],
    ['a timestamp with an offset', raw({ ...POSITION, createdAt: '2026-10-19T10:00:00.123+02:00' })],
    ['a timestamp that is no time', raw({ ...POSITION, createdAt: 'yesterday' })],
    ['a timestamp as a number', raw({ ...POSITION, createdAt: 1_792_396_800_123 })],
    ['an id that is no UUID', raw({ ...POSITION, id: 'abc' })],
    ['an id as a number', raw({ ...POSITION, id: 42 })],
  ])('refuses %s', (_name, value) => {
    expect(decodeListCursor(value)).toBeUndefined()
  })

  it('refuses a cursor longer than the limit, even one that would decode', () => {
    // Valid JSON of a valid position, only with white space after the opening brace.
    const padded = (spaces: number): string =>
      Buffer.from(`{${' '.repeat(spaces)}${JSON.stringify(POSITION).slice(1)}`).toString('base64url')

    expect(padded(100).length).toBeGreaterThan(LIST_CURSOR_MAX_LENGTH)
    expect(decodeListCursor(padded(100))).toBeUndefined()
    expect(decodeListCursor(padded(2))).toStrictEqual(POSITION)
  })
})

describe('isListCursor', () => {
  it('takes a decoded cursor and nothing else', () => {
    expect(isListCursor(POSITION)).toBe(true)
    expect(isListCursor(raw(POSITION))).toBe(false)
    expect(isListCursor({ ...POSITION, extra: true })).toBe(false)
    expect(isListCursor(null)).toBe(false)
  })
})
