import { NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { ACCOUNT_ID, OWNER, useAccountsController, VIEW } from './setup'

const PATH = `/api/accounts/${ACCOUNT_ID}`

type ErrorBody = { message: string[] | string }

describe('PATCH /api/accounts/:id', () => {
  const { accounts, send, anonymous, calls } = useAccountsController()

  it('answers 200 with the changed account', async () => {
    const response = await send('patch', PATH, { name: 'Savings' }).expect(200)

    expect(response.body).toStrictEqual(VIEW)
    expect(accounts.update).toHaveBeenCalledExactlyOnceWith(
      OWNER,
      ACCOUNT_ID,
      expect.objectContaining({ name: 'Savings' }),
    )
  })

  it('takes any subset of name, type and opening balance', async () => {
    await send('patch', PATH, { type: 'cash', openingBalance: '-20' }).expect(200)

    const input = accounts.update.mock.calls[0]?.[2]
    expect(input).toEqual({ type: 'cash', openingBalance: '-20' })
  })

  it('takes an empty body as no change', async () => {
    await send('patch', PATH, {}).expect(200)

    expect(accounts.update.mock.calls[0]?.[2]).toEqual({})
  })

  it.each([
    ['a new currency', 'EUR'],
    ['the same currency', 'CZK'],
    ['a null currency', null],
  ])('answers 400 for %s: the currency is set on create only', async (_name, currency) => {
    const response = await send('patch', PATH, { name: 'Savings', currency }).expect(400)

    expect((response.body as ErrorBody).message).toEqual(['currency cannot be changed after the account is created'])
    expect(calls()).toBe(0)
  })

  it.each([
    ['a null name', { name: null }],
    ['a null type', { type: null }],
    ['a null opening balance', { openingBalance: null }],
    ['a blank name', { name: '  ' }],
    ['an unknown type', { type: 'credit' }],
    ['an opening balance as a JSON number', { openingBalance: 20 }],
    ['an opening balance with five decimal places', { openingBalance: '0.00001' }],
  ])('answers 400 for %s, before the service runs', async (_name, body) => {
    await send('patch', PATH, body).expect(400)

    expect(calls()).toBe(0)
  })

  it('answers 400 for an id that is not a UUID', async () => {
    await send('patch', '/api/accounts/abc', { name: 'Savings' }).expect(400)

    expect(calls()).toBe(0)
  })

  it('passes the 404 of a missing or foreign account through unchanged', async () => {
    accounts.update.mockRejectedValue(new NotFoundException('Account not found'))

    const response = await send('patch', PATH, { name: 'Savings' }).expect(404)

    expect((response.body as ErrorBody).message).toBe('Account not found')
  })

  it('answers 401 without a token and does not run the service', async () => {
    await anonymous('patch', PATH).send({ name: 'Savings' }).expect(401)

    expect(calls()).toBe(0)
  })
})
