import { describe, expect, it } from 'vitest'

import { encodeListCursor } from '../../../../../src/modules/transactions/transactions/transactions.cursor'

import { ACCOUNT_ID, CATEGORY_ID, type ErrorBody, OWNER, PAGE, useTransactionsController } from './setup'

const PATH = '/api/transactions'

const KEY = {
  date: new Date('2026-10-19T00:00:00.000Z'),
  createdAt: new Date('2026-10-19T08:00:00.123Z'),
  id: '9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d',
}
const DESC_CURSOR = encodeListCursor(KEY, 'desc')
const ASC_CURSOR = encodeListCursor(KEY, 'asc')

/** Any JSON as a cursor would carry it, for the shapes the list never issues. */
const raw = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url')

describe('GET /api/transactions', () => {
  const { transactions, send, anonymous, calls } = useTransactionsController()

  // Own properties of the DTO instance; `toEqual` below, because the parameters left out are own `undefined` ones.
  const inputOf = (): object => ({ ...transactions.list.mock.calls[0]?.[1] })

  it('answers 200 with the page of the service', async () => {
    const response = await send('get', PATH).expect(200)

    expect(response.body).toStrictEqual(PAGE)
  })

  it('lists for the owner of the token the first page, newest first, 50 at most, with no filter', async () => {
    await send('get', PATH).expect(200)

    expect(transactions.list).toHaveBeenCalledOnce()
    expect(transactions.list.mock.calls[0]?.[0]).toStrictEqual(OWNER)
    expect(inputOf()).toEqual({ order: 'desc', limit: 50 })
  })

  it('passes every parameter on, the limit as a number and the cursor decoded', async () => {
    await send('get', PATH)
      .query({
        accountId: ACCOUNT_ID,
        categoryId: CATEGORY_ID,
        type: 'expense',
        from: '2026-10-01',
        to: '2026-10-31',
        order: 'asc',
        limit: '7',
        cursor: ASC_CURSOR,
      })
      .expect(200)

    expect(inputOf()).toEqual({
      accountId: ACCOUNT_ID,
      categoryId: CATEGORY_ID,
      type: 'expense',
      from: '2026-10-01',
      to: '2026-10-31',
      order: 'asc',
      limit: 7,
      cursor: { order: 'asc', date: '2026-10-19', createdAt: '2026-10-19T08:00:00.123Z', id: KEY.id },
    })
  })

  it.each([
    ['a transfer as the type: the list shows both sides', { type: 'transfer' }],
    ['a range of one day', { from: '2026-10-19', to: '2026-10-19' }],
    ['a range open at the end', { from: '2026-10-01' }],
    ['a range open at the start', { to: '2026-10-31' }],
    ['the smallest limit', { limit: '1' }],
    ['the largest limit', { limit: '100' }],
    ['the oldest first', { order: 'asc' }],
    ['a cursor of a desc list with the default order', { cursor: DESC_CURSOR }],
    ['a cursor of a desc list with order=desc', { order: 'desc', cursor: DESC_CURSOR }],
  ])('accepts %s', async (_name, query) => {
    await send('get', PATH).query(query).expect(200)

    expect(transactions.list).toHaveBeenCalledOnce()
  })

  it.each([
    ['an account id that is no UUID', 'accountId=abc', 'accountId must be a UUID'],
    ['an empty account id', 'accountId=', 'accountId must be a UUID'],
    ['two account ids', `accountId=${ACCOUNT_ID}&accountId=${ACCOUNT_ID}`, 'accountId must be a UUID'],
    ['a category id that is no UUID', 'categoryId=abc', 'categoryId must be a UUID'],
    ['an unknown type', 'type=foo', 'type must be one of the following values: income, expense, transfer'],
    ['a type in capitals', 'type=INCOME', 'type must be one of the following values: income, expense, transfer'],
    ['an empty type', 'type=', 'type must be one of the following values: income, expense, transfer'],
    ['a day that does not exist', 'from=2026-02-30', 'from must be a calendar date YYYY-MM-DD'],
    ['a day without leading zeros', 'to=2026-1-5', 'to must be a calendar date YYYY-MM-DD'],
    ['a day with a time', 'to=2026-10-19T00:00:00Z', 'to must be a calendar date YYYY-MM-DD'],
    ['a range that ends before it starts', 'from=2026-10-19&to=2026-10-18', 'to must not be before from'],
    ['an order in capitals', 'order=ASC', 'order must be one of the following values: desc, asc'],
    ['an unknown order', 'order=up', 'order must be one of the following values: desc, asc'],
    ['an empty order', 'order=', 'order must be one of the following values: desc, asc'],
    ...[
      ['a limit of 0', '0'],
      ['a negative limit', '-1'],
      ['a fraction', '1.5'],
      ['letters', 'abc'],
      ['an exponent', '1e2'],
      ['hexadecimal', '0x10'],
      ['a leading space', '%202'],
      ['a leading zero', '01'],
      ['an empty limit', ''],
      ['a limit above the maximum', '101'],
    ].map(([name, limit]) => [name, `limit=${limit}`, 'limit must be a whole number from 1 to 100']),
    ['two limits', 'limit=1&limit=2', 'limit must be a whole number from 1 to 100'],
    ['an empty cursor', 'cursor=', 'cursor must be the nextCursor of a previous page, as it came'],
    [
      'a cursor that is no base64url',
      'cursor=abc%2B%2F',
      'cursor must be the nextCursor of a previous page, as it came',
    ],
    [
      'a cursor of base64url that is no JSON',
      `cursor=${Buffer.from('not json').toString('base64url')}`,
      'cursor must be the nextCursor of a previous page, as it came',
    ],
    [
      'a cursor with a key too many',
      `cursor=${raw({ order: 'desc', date: '2026-10-19', createdAt: '2026-10-19T08:00:00.123Z', id: KEY.id, userId: KEY.id })}`,
      'cursor must be the nextCursor of a previous page, as it came',
    ],
    [
      'a cursor with a day that does not exist',
      `cursor=${raw({ order: 'desc', date: '2026-02-30', createdAt: '2026-10-19T08:00:00.123Z', id: KEY.id })}`,
      'cursor must be the nextCursor of a previous page, as it came',
    ],
    [
      'a cursor with a timestamp that is not the one the list writes',
      `cursor=${raw({ order: 'desc', date: '2026-10-19', createdAt: '2026-10-19T08:00:00Z', id: KEY.id })}`,
      'cursor must be the nextCursor of a previous page, as it came',
    ],
    [
      'a cursor with an id that is no UUID',
      `cursor=${raw({ order: 'desc', date: '2026-10-19', createdAt: '2026-10-19T08:00:00.123Z', id: 'abc' })}`,
      'cursor must be the nextCursor of a previous page, as it came',
    ],
    [
      'a cursor longer than the limit',
      `cursor=${'a'.repeat(257)}`,
      'cursor must be the nextCursor of a previous page, as it came',
    ],
    [
      'two cursors',
      `cursor=${DESC_CURSOR}&cursor=${DESC_CURSOR}`,
      'cursor must be the nextCursor of a previous page, as it came',
    ],
    [
      'a cursor of a desc list with order=asc',
      `order=asc&cursor=${DESC_CURSOR}`,
      'cursor was issued for the other order',
    ],
    ['a cursor of an asc list with the default order', `cursor=${ASC_CURSOR}`, 'cursor was issued for the other order'],
  ])('answers 400 for %s, before the service runs', async (_name, query, message) => {
    const response = await send('get', `${PATH}?${query}`).expect(400)

    expect((response.body as ErrorBody).message).toEqual([message])
    expect(calls()).toBe(0)
  })

  it('drops an unknown parameter, a misspelt filter included: the list is then not filtered by it', async () => {
    await send('get', PATH).query({ sort: 'asc', userId: OWNER.userId, accountid: ACCOUNT_ID }).expect(200)

    expect(transactions.list.mock.calls[0]?.[0]).toStrictEqual(OWNER)
    expect(inputOf()).toEqual({ order: 'desc', limit: 50 })
    expect(Object.keys(inputOf())).not.toContain('sort')
  })

  it('answers 401 without a token, before the parameters are checked', async () => {
    await anonymous('get', `${PATH}?limit=0&accountId=abc`).expect(401)

    expect(calls()).toBe(0)
  })
})
