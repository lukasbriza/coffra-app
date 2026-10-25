import { NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { type ErrorBody, OWNER, useTransactionsController, VALID_BODY, VIEW } from './setup'

const PATH = '/api/transactions'

describe('POST /api/transactions', () => {
  const { transactions, send, anonymous, calls } = useTransactionsController()

  const inputOf = (): object => ({ ...transactions.create.mock.calls[0]?.[1] })

  it('answers 201 with the created transaction', async () => {
    const response = await send('post', PATH, VALID_BODY).expect(201)

    expect(response.body).toStrictEqual(VIEW)
  })

  it('creates the transaction for the owner of the token, the amount and the date as the strings sent', async () => {
    await send('post', PATH, VALID_BODY).expect(201)

    expect(transactions.create).toHaveBeenCalledExactlyOnceWith(OWNER, VALID_BODY)
    expect(inputOf()).toStrictEqual(VALID_BODY) // own properties of the DTO instance, nothing added or converted
  })

  it('never lets the body choose the owner, the id or the fields of a transfer', async () => {
    const foreign = '7d1c2b9a-5e4f-4a3b-8c2d-1e0f9a8b7c62'

    await send('post', PATH, {
      ...VALID_BODY,
      userId: foreign,
      tenantId: foreign,
      id: foreign,
      transferPairId: foreign,
      transferDirection: 'out',
    }).expect(201)

    expect(transactions.create.mock.calls[0]?.[0]).toStrictEqual(OWNER)
    expect(inputOf()).toStrictEqual(VALID_BODY)
  })

  it('accepts no category and no note, and null for either', async () => {
    const { categoryId: _categoryId, note: _note, ...required } = VALID_BODY

    await send('post', PATH, required).expect(201)
    await send('post', PATH, { ...required, categoryId: null, note: null }).expect(201)

    // `toEqual`: the fields left out are own `undefined` properties of the DTO instance (class fields)
    expect(transactions.create.mock.calls.map(([, input]) => ({ ...input }))).toEqual([
      required,
      { ...required, categoryId: null, note: null },
    ])
  })

  it('trims the note and turns a blank one into null', async () => {
    await send('post', PATH, { ...VALID_BODY, note: '  Lunch \n' }).expect(201)
    await send('post', PATH, { ...VALID_BODY, note: ' '.repeat(3) }).expect(201)

    expect(transactions.create.mock.calls.map(([, input]) => input.note)).toEqual(['Lunch', null])
  })

  it.each([
    ['no account', { accountId: undefined }],
    ['an account id that is not a UUID', { accountId: 'abc' }],
    ['a null account', { accountId: null }],
    ['no type', { type: undefined }],
    ['the type transfer', { type: 'transfer' }],
    ['an unknown type', { type: 'refund' }],
    ['a null type', { type: null }],
    ['no amount', { amount: undefined }],
    ['an amount as a JSON number', { amount: 1250.5 }],
    ['a zero amount', { amount: '0' }],
    ['a zero amount with decimal places', { amount: '0.0000' }],
    ['a negative amount', { amount: '-5' }],
    ['an amount with five decimal places', { amount: '0.00001' }],
    ['an amount too big for the column', { amount: '1000000000000000' }],
    ['an amount with an exponent', { amount: '1e3' }],
    ['an empty amount', { amount: '' }],
    ['a null amount', { amount: null }],
    ['no date', { date: undefined }],
    ['a date without leading zeros', { date: '2026-1-5' }],
    ['a day that does not exist', { date: '2026-02-30' }],
    ['29 February outside a leap year', { date: '2026-02-29' }],
    ['month 13', { date: '2026-13-01' }],
    ['year 0', { date: '0000-01-01' }],
    ['a date with a time', { date: '2026-10-19T00:00:00Z' }],
    ['a date as a number', { date: 1_792_368_000_000 }],
    ['a null date', { date: null }],
    ['a category id that is not a UUID', { categoryId: 'abc' }],
    ['a note that is a number', { note: 42 }],
    ['a note of 501 characters', { note: 'a'.repeat(501) }],
  ])('answers 400 for %s, before the service runs', async (_name, override) => {
    const response = await send('post', PATH, { ...VALID_BODY, ...override }).expect(400)

    expect((response.body as ErrorBody).statusCode).toBe(400)
    expect(calls()).toBe(0)
  })

  it('says why a transfer is refused here', async () => {
    const response = await send('post', PATH, { ...VALID_BODY, type: 'transfer' }).expect(400)

    expect((response.body as ErrorBody).message).toEqual([
      'type must be income or expense (a transfer has an API of its own)',
    ])
  })

  it('says what is wrong with the date', async () => {
    const response = await send('post', PATH, { ...VALID_BODY, date: '2026-02-30' }).expect(400)

    expect((response.body as ErrorBody).message).toEqual(['date must be a calendar date YYYY-MM-DD'])
  })

  it('passes the 404 of an account or a category that the owner does not have through unchanged', async () => {
    transactions.create.mockRejectedValue(new NotFoundException('Category not found'))

    const response = await send('post', PATH, VALID_BODY).expect(404)

    expect(response.body).toStrictEqual({ statusCode: 404, message: 'Category not found', error: 'Not Found' })
  })

  it('answers 401 without a token and does not run the service', async () => {
    await anonymous('post', PATH).send(VALID_BODY).expect(401)

    expect(calls()).toBe(0)
  })
})
