import { ConflictException, NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import {
  CATEGORY_ID,
  type ErrorBody,
  FROM_ACCOUNT_ID,
  OWNER,
  TO_ACCOUNT_ID,
  useTransfersController,
  VALID_BODY,
  VIEW,
} from './setup'

const PATH = '/api/transfers'

describe('POST /api/transfers', () => {
  const { transfers, send, anonymous, calls } = useTransfersController()

  /**
   * The own properties of the DTO instance the service got. `categoryId` is declared on the DTO only to be refused, so
   * every instance carries it as an own `undefined`: checked here and left out of the comparison.
   */
  const inputOf = (call = 0): object => {
    const { categoryId, ...input } = { ...transfers.create.mock.calls[call]?.[1] } as Record<string, unknown>

    expect(categoryId).toBeUndefined()
    return input
  }

  it('answers 201 with the created transfer', async () => {
    const response = await send('post', PATH, VALID_BODY).expect(201)

    expect(response.body).toStrictEqual(VIEW)
  })

  it('creates the transfer for the owner of the token, the amount and the date as the strings sent', async () => {
    await send('post', PATH, VALID_BODY).expect(201)

    expect(transfers.create).toHaveBeenCalledExactlyOnceWith(OWNER, VALID_BODY)
    expect(inputOf()).toStrictEqual(VALID_BODY) // own properties of the DTO instance, nothing added or converted
  })

  it('lower-cases the account ids, so the service compares them as the database does', async () => {
    await send('post', PATH, {
      ...VALID_BODY,
      fromAccountId: FROM_ACCOUNT_ID.toUpperCase(),
      toAccountId: TO_ACCOUNT_ID.toUpperCase(),
    }).expect(201)

    expect(inputOf()).toStrictEqual(VALID_BODY)
  })

  it('never lets the body choose the owner, the type or the fields of the pair', async () => {
    const foreign = '7d1c2b9a-5e4f-4a3b-8c2d-1e0f9a8b7c62'

    await send('post', PATH, {
      ...VALID_BODY,
      userId: foreign,
      id: foreign,
      type: 'income',
      pairId: foreign,
      transferPairId: foreign,
      transferDirection: 'in',
    }).expect(201)

    expect(transfers.create.mock.calls[0]?.[0]).toStrictEqual(OWNER)
    expect(inputOf()).toStrictEqual(VALID_BODY)
  })

  it('accepts no note and null, and trims the note, a blank one to null', async () => {
    const { note: _note, ...required } = VALID_BODY

    await send('post', PATH, required).expect(201)
    await send('post', PATH, { ...required, note: null }).expect(201)
    await send('post', PATH, { ...required, note: '  Savings \n' }).expect(201)
    await send('post', PATH, { ...required, note: ' '.repeat(3) }).expect(201)

    expect(transfers.create.mock.calls.map(([, input]) => input.note)).toEqual([undefined, null, 'Savings', null])
  })

  it.each([
    ['no source account', { fromAccountId: undefined }],
    ['a source id that is not a UUID', { fromAccountId: 'abc' }],
    ['a null source', { fromAccountId: null }],
    ['no target account', { toAccountId: undefined }],
    ['a target id that is not a UUID', { toAccountId: 'abc' }],
    ['a null target', { toAccountId: null }],
    ['the same account on both sides', { toAccountId: FROM_ACCOUNT_ID }],
    ['the same account spelled in two letter cases', { toAccountId: FROM_ACCOUNT_ID.toUpperCase() }],
    ['no amount', { amount: undefined }],
    ['an amount as a JSON number', { amount: 5000 }],
    ['a zero amount', { amount: '0' }],
    ['a zero amount with decimal places', { amount: '0.0000' }],
    ['a negative amount', { amount: '-5' }],
    ['an amount with five decimal places', { amount: '0.00001' }],
    ['an amount too big for the column', { amount: '1000000000000000' }],
    ['an amount with an exponent', { amount: '1e3' }],
    ['a null amount', { amount: null }],
    ['no date', { date: undefined }],
    ['a day that does not exist', { date: '2026-02-30' }],
    ['a date with a time', { date: '2026-10-21T00:00:00Z' }],
    ['a null date', { date: null }],
    ['a note that is a number', { note: 42 }],
    ['a note of 501 characters', { note: 'a'.repeat(501) }],
    ['a category', { categoryId: CATEGORY_ID }],
    ['a null category', { categoryId: null }],
    ['a category that is not a UUID', { categoryId: 'abc' }],
  ])('answers 400 for %s, before the service runs', async (_name, override) => {
    const response = await send('post', PATH, { ...VALID_BODY, ...override }).expect(400)

    expect((response.body as ErrorBody).statusCode).toBe(400)
    expect(calls()).toBe(0)
  })

  it('says that a transfer has no category', async () => {
    const response = await send('post', PATH, { ...VALID_BODY, categoryId: CATEGORY_ID }).expect(400)

    expect((response.body as ErrorBody).message).toEqual(['a transfer has no category'])
  })

  it('says that the accounts must differ, once', async () => {
    const response = await send('post', PATH, { ...VALID_BODY, toAccountId: FROM_ACCOUNT_ID }).expect(400)

    expect((response.body as ErrorBody).message).toEqual(['toAccountId must differ from fromAccountId'])
  })

  it('reports two invalid account ids once each', async () => {
    const response = await send('post', PATH, { ...VALID_BODY, fromAccountId: 'abc', toAccountId: 'abc' }).expect(400)

    expect((response.body as ErrorBody).message).toEqual(['fromAccountId must be a UUID', 'toAccountId must be a UUID'])
  })

  it('passes the 404 of an account that the owner does not have through unchanged', async () => {
    transfers.create.mockRejectedValue(new NotFoundException('Account not found'))

    const response = await send('post', PATH, VALID_BODY).expect(404)

    expect(response.body).toStrictEqual({ statusCode: 404, message: 'Account not found', error: 'Not Found' })
  })

  it('passes the 409 of accounts in different currencies through unchanged', async () => {
    const message = 'A transfer needs two accounts in the same currency'
    transfers.create.mockRejectedValue(new ConflictException(message))

    const response = await send('post', PATH, VALID_BODY).expect(409)

    expect(response.body).toStrictEqual({ statusCode: 409, message, error: 'Conflict' })
  })

  it('answers 401 without a token and does not run the service', async () => {
    await anonymous('post', PATH).send(VALID_BODY).expect(401)

    expect(calls()).toBe(0)
  })
})
