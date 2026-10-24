import { UnauthorizedException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { OWNER, useAccountsController, VALID_BODY, VIEW } from './setup'

type ErrorBody = { statusCode: number; message: string[] | string }

describe('POST /api/accounts', () => {
  const { accounts, send, anonymous, calls } = useAccountsController()

  it('answers 201 with the created account', async () => {
    const response = await send('post', '/api/accounts', VALID_BODY).expect(201)

    expect(response.body).toStrictEqual(VIEW)
  })

  it('creates the account for the owner of the token, with the fields of the body', async () => {
    await send('post', '/api/accounts', VALID_BODY).expect(201)

    expect(accounts.create).toHaveBeenCalledExactlyOnceWith(OWNER, VALID_BODY)
  })

  it('never lets the body choose the owner or anything else outside the fields', async () => {
    const foreign = '7d1c2b9a-5e4f-4a3b-8c2d-1e0f9a8b7c62'

    await send('post', '/api/accounts', { ...VALID_BODY, userId: foreign, tenantId: foreign, id: foreign }).expect(201)

    const [owner, input] = accounts.create.mock.calls[0] ?? []
    expect(owner).toStrictEqual(OWNER)
    expect(input).not.toHaveProperty('userId')
    expect(input).not.toHaveProperty('tenantId')
    expect(input).not.toHaveProperty('id')
  })

  it('trims the name', async () => {
    await send('post', '/api/accounts', { ...VALID_BODY, name: '  Main account ' }).expect(201)

    expect(accounts.create.mock.calls[0]?.[1].name).toBe('Main account')
  })

  it('accepts a negative opening balance, and none at all', async () => {
    await send('post', '/api/accounts', { ...VALID_BODY, openingBalance: '-1500.25' }).expect(201)
    await send('post', '/api/accounts', { name: 'Wallet', type: 'cash', currency: 'EUR' }).expect(201)

    expect(accounts.create.mock.calls[0]?.[1].openingBalance).toBe('-1500.25')
    expect(accounts.create.mock.calls[1]?.[1].openingBalance).toBeUndefined()
  })

  it.each([
    ['no name', { name: undefined }],
    ['an empty name', { name: '' }],
    ['a blank name', { name: ' '.repeat(3) }],
    ['a name of 101 characters', { name: 'a'.repeat(101) }],
    ['a name that is a number', { name: 42 }],
    ['a null name', { name: null }],
    ['no type', { type: undefined }],
    ['an unknown type', { type: 'credit' }],
    ['a null type', { type: null }],
    ['no currency', { currency: undefined }],
    ['a lower-case currency', { currency: 'czk' }],
    ['a currency of two letters', { currency: 'CZ' }],
    ['a currency of four letters', { currency: 'CZKK' }],
    ['a currency with a digit', { currency: 'CZ1' }],
    ['a currency with a trailing newline', { currency: 'CZK\n' }],
    ['a null currency', { currency: null }],
    ['an opening balance as a JSON number', { openingBalance: 1250.5 }],
    ['an opening balance with five decimal places', { openingBalance: '0.00001' }],
    ['an opening balance too big for the column', { openingBalance: '1000000000000000' }],
    ['an opening balance with an exponent', { openingBalance: '1e3' }],
    ['an empty opening balance', { openingBalance: '' }],
    ['a null opening balance', { openingBalance: null }],
  ])('answers 400 for %s, before the service runs', async (_name, override) => {
    const response = await send('post', '/api/accounts', { ...VALID_BODY, ...override }).expect(400)

    expect((response.body as ErrorBody).statusCode).toBe(400)
    expect(calls()).toBe(0)
  })

  it('says what is wrong with the currency', async () => {
    const response = await send('post', '/api/accounts', { ...VALID_BODY, currency: 'czk' }).expect(400)

    expect((response.body as ErrorBody).message).toEqual(['currency must be three capital letters'])
  })

  it('answers 401 without a token and does not run the service', async () => {
    await anonymous('post', '/api/accounts').send(VALID_BODY).expect(401)

    expect(calls()).toBe(0)
  })

  it('passes the 401 of a deleted owner through', async () => {
    accounts.create.mockRejectedValue(new UnauthorizedException('Invalid or expired access token'))

    const response = await send('post', '/api/accounts', VALID_BODY).expect(401)

    expect((response.body as ErrorBody).message).toBe('Invalid or expired access token')
  })
})
