import { ConflictException, NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { ACCOUNT_ID, type ErrorBody, OWNER, TRANSACTION_ID, useTransactionsController, VIEW } from './setup'

const PATH = `/api/transactions/${TRANSACTION_ID}`

describe('PATCH /api/transactions/:id', () => {
  const { transactions, send, anonymous, calls } = useTransactionsController()

  const inputOf = (): object => ({ ...transactions.update.mock.calls[0]?.[2] })

  it('answers 200 with the changed transaction', async () => {
    const response = await send('patch', PATH, { amount: '99.9' }).expect(200)

    expect(response.body).toStrictEqual(VIEW)
    expect(transactions.update).toHaveBeenCalledExactlyOnceWith(OWNER, TRANSACTION_ID, { amount: '99.9' })
  })

  it('takes an empty body as no change', async () => {
    await send('patch', PATH, {}).expect(200)

    expect(inputOf()).toStrictEqual({})
  })

  it('passes every field of a create on', async () => {
    const body = { accountId: ACCOUNT_ID, type: 'income', amount: '10', date: '2024-02-29', note: 'Salary' }

    await send('patch', PATH, body).expect(200)

    expect(inputOf()).toStrictEqual(body)
  })

  it('accepts null for the category and the note: it clears them', async () => {
    await send('patch', PATH, { categoryId: null, note: null }).expect(200)

    expect(inputOf()).toStrictEqual({ categoryId: null, note: null })
  })

  it('turns a blank note into null', async () => {
    await send('patch', PATH, { note: '  ' }).expect(200)

    expect(inputOf()).toStrictEqual({ note: null })
  })

  it.each([
    ['a null account', { accountId: null }],
    ['a null type', { type: null }],
    ['a null amount', { amount: null }],
    ['a null date', { date: null }],
    ['the type transfer', { type: 'transfer' }],
    ['a zero amount', { amount: '0' }],
    ['an amount as a JSON number', { amount: 10 }],
    ['a day that does not exist', { date: '2026-04-31' }],
    ['an account id that is not a UUID', { accountId: 'abc' }],
    ['a category id that is not a UUID', { categoryId: 'abc' }],
    ['a note of 501 characters', { note: 'a'.repeat(501) }],
  ])('answers 400 for %s, before the service runs', async (_name, body) => {
    await send('patch', PATH, body).expect(400)

    expect(calls()).toBe(0)
  })

  it('answers 400 for an id that is not a UUID', async () => {
    await send('patch', '/api/transactions/abc', { amount: '10' }).expect(400)

    expect(calls()).toBe(0)
  })

  it.each([
    'Transaction is part of a transfer and cannot be changed here',
    'A transaction cannot move to an account in another currency',
  ])('passes the 409 "%s" through unchanged', async (message) => {
    transactions.update.mockRejectedValue(new ConflictException(message))

    const response = await send('patch', PATH, { amount: '10' }).expect(409)

    expect(response.body).toStrictEqual({ statusCode: 409, message, error: 'Conflict' })
  })

  it.each(['Transaction not found', 'Account not found', 'Category not found'])(
    'passes the 404 "%s" through unchanged',
    async (message) => {
      transactions.update.mockRejectedValue(new NotFoundException(message))

      const response = await send('patch', PATH, { amount: '10' }).expect(404)

      expect((response.body as ErrorBody).message).toBe(message)
    },
  )

  it('answers 401 without a token and does not run the service', async () => {
    await anonymous('patch', PATH).send({ amount: '10' }).expect(401)

    expect(calls()).toBe(0)
  })
})
