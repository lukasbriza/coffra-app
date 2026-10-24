import { ConflictException, NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { ACCOUNT_ID, OWNER, useAccountsController } from './setup'

const PATH = `/api/accounts/${ACCOUNT_ID}`

describe('DELETE /api/accounts/:id', () => {
  const { accounts, send, anonymous, calls } = useAccountsController()

  it('answers 204 with an empty body', async () => {
    const response = await send('delete', PATH).expect(204)

    expect(response.text).toBe('')
    expect(accounts.remove).toHaveBeenCalledExactlyOnceWith(OWNER, ACCOUNT_ID)
  })

  it('passes the 409 of an account with transactions through unchanged', async () => {
    accounts.remove.mockRejectedValue(new ConflictException('Account has transactions and cannot be deleted'))

    const response = await send('delete', PATH).expect(409)

    expect(response.body).toStrictEqual({
      statusCode: 409,
      message: 'Account has transactions and cannot be deleted',
      error: 'Conflict',
    })
  })

  it('passes the 404 of a missing or foreign account through unchanged', async () => {
    accounts.remove.mockRejectedValue(new NotFoundException('Account not found'))

    await send('delete', PATH).expect(404)
  })

  it('answers 400 for an id that is not a UUID', async () => {
    await send('delete', '/api/accounts/abc').expect(400)

    expect(calls()).toBe(0)
  })

  it('answers 401 without a token and does not run the service', async () => {
    await anonymous('delete', PATH).expect(401)

    expect(calls()).toBe(0)
  })
})
