import { NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { ACCOUNT_ID, OWNER, useAccountsController, VIEW } from './setup'

describe('GET /api/accounts/:id', () => {
  const { accounts, send, anonymous, calls } = useAccountsController()

  it('answers 200 with the account', async () => {
    const response = await send('get', `/api/accounts/${ACCOUNT_ID}`).expect(200)

    expect(response.body).toStrictEqual(VIEW)
    expect(accounts.findOne).toHaveBeenCalledExactlyOnceWith(OWNER, ACCOUNT_ID)
  })

  it.each(['abc', '123', `${ACCOUNT_ID}0`, ACCOUNT_ID.replaceAll('-', '')])(
    'answers 400 for the id %j, before the service runs',
    async (id) => {
      const response = await send('get', `/api/accounts/${id}`).expect(400)

      expect((response.body as { message: string }).message).toBe('Validation failed (uuid is expected)')
      expect(calls()).toBe(0)
    },
  )

  it('lets any well-formed UUID through to the lookup, whatever its version or case', async () => {
    await send('get', '/api/accounts/00000000-0000-0000-0000-000000000000').expect(200)
    await send('get', `/api/accounts/${ACCOUNT_ID.toUpperCase()}`).expect(200)

    expect(accounts.findOne).toHaveBeenCalledTimes(2)
  })

  it('passes the 404 of a missing or foreign account through unchanged', async () => {
    accounts.findOne.mockRejectedValue(new NotFoundException('Account not found'))

    const response = await send('get', `/api/accounts/${ACCOUNT_ID}`).expect(404)

    expect(response.body).toStrictEqual({ statusCode: 404, message: 'Account not found', error: 'Not Found' })
  })

  it('answers 401 without a token, before the id is checked', async () => {
    await anonymous('get', '/api/accounts/abc').expect(401)

    expect(calls()).toBe(0)
  })
})
