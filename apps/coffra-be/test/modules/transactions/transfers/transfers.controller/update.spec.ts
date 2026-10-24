import { ConflictException, NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import {
  CATEGORY_ID,
  type ErrorBody,
  FROM_ACCOUNT_ID,
  OWNER,
  PAIR_ID,
  TO_ACCOUNT_ID,
  useTransfersController,
  VIEW,
} from './setup'

const PATH = `/api/transfers/${PAIR_ID}`

describe('PATCH /api/transfers/:pairId', () => {
  const { transfers, send, anonymous, calls } = useTransfersController()

  const inputOf = (): object => ({ ...transfers.update.mock.calls[0]?.[2] })

  it('answers 200 with the changed transfer', async () => {
    const response = await send('patch', PATH, { amount: '99.9' }).expect(200)

    expect(response.body).toStrictEqual(VIEW)
    expect(transfers.update).toHaveBeenCalledExactlyOnceWith(OWNER, PAIR_ID, { amount: '99.9' })
  })

  it('takes an empty body as no change', async () => {
    await send('patch', PATH, {}).expect(200)

    expect(inputOf()).toStrictEqual({})
  })

  it('passes every field of a create on, the account ids in lower case', async () => {
    await send('patch', PATH, {
      fromAccountId: TO_ACCOUNT_ID.toUpperCase(),
      toAccountId: FROM_ACCOUNT_ID,
      amount: '10',
      date: '2024-02-29',
      note: 'Rent',
    }).expect(200)

    expect(inputOf()).toStrictEqual({
      fromAccountId: TO_ACCOUNT_ID,
      toAccountId: FROM_ACCOUNT_ID,
      amount: '10',
      date: '2024-02-29',
      note: 'Rent',
    })
  })

  it('passes one account on alone: whether it meets the other side is for the service to decide', async () => {
    await send('patch', PATH, { toAccountId: FROM_ACCOUNT_ID }).expect(200)

    expect(inputOf()).toStrictEqual({ toAccountId: FROM_ACCOUNT_ID })
  })

  it('accepts null for the note, and turns a blank note into null: it clears it', async () => {
    await send('patch', PATH, { note: null }).expect(200)
    await send('patch', PATH, { note: '  ' }).expect(200)

    expect(transfers.update.mock.calls.map((call) => ({ ...call[2] }))).toStrictEqual([{ note: null }, { note: null }])
  })

  it.each([
    ['a null source', { fromAccountId: null }],
    ['a null target', { toAccountId: null }],
    ['a null amount', { amount: null }],
    ['a null date', { date: null }],
    ['the same account twice', { fromAccountId: FROM_ACCOUNT_ID, toAccountId: FROM_ACCOUNT_ID }],
    [
      'the same account twice in two letter cases',
      { fromAccountId: FROM_ACCOUNT_ID, toAccountId: FROM_ACCOUNT_ID.toUpperCase() },
    ],
    ['a zero amount', { amount: '0' }],
    ['an amount as a JSON number', { amount: 10 }],
    ['a day that does not exist', { date: '2026-04-31' }],
    ['an account id that is not a UUID', { toAccountId: 'abc' }],
    ['a note of 501 characters', { note: 'a'.repeat(501) }],
    ['a category', { categoryId: CATEGORY_ID }],
    ['a null category', { categoryId: null }],
  ])('answers 400 for %s, before the service runs', async (_name, body) => {
    await send('patch', PATH, body).expect(400)

    expect(calls()).toBe(0)
  })

  it('says that a transfer has no category', async () => {
    const response = await send('patch', PATH, { categoryId: null }).expect(400)

    expect((response.body as ErrorBody).message).toEqual(['a transfer has no category'])
  })

  it('answers 400 for a pairId that is not a UUID', async () => {
    await send('patch', '/api/transfers/abc', { amount: '10' }).expect(400)

    expect(calls()).toBe(0)
  })

  it.each(['A transfer needs two different accounts', 'A transfer cannot move to an account in another currency'])(
    'passes the 409 "%s" through unchanged',
    async (message) => {
      transfers.update.mockRejectedValue(new ConflictException(message))

      const response = await send('patch', PATH, { toAccountId: FROM_ACCOUNT_ID }).expect(409)

      expect(response.body).toStrictEqual({ statusCode: 409, message, error: 'Conflict' })
    },
  )

  it.each(['Transfer not found', 'Account not found'])('passes the 404 "%s" through unchanged', async (message) => {
    transfers.update.mockRejectedValue(new NotFoundException(message))

    const response = await send('patch', PATH, { amount: '10' }).expect(404)

    expect((response.body as ErrorBody).message).toBe(message)
  })

  it('answers 401 without a token and does not run the service', async () => {
    await anonymous('patch', PATH).send({ amount: '10' }).expect(401)

    expect(calls()).toBe(0)
  })
})
