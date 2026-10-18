import { describe, expect, it } from 'vitest'

import { OWNER, useAccountsController, VIEW } from './setup'

describe('GET /api/accounts', () => {
  const { accounts, send, anonymous, calls } = useAccountsController()

  it('answers 200 with the accounts of the owner of the token', async () => {
    const response = await send('get', '/api/accounts').expect(200)

    expect(response.body).toStrictEqual([VIEW])
    expect(accounts.list).toHaveBeenCalledExactlyOnceWith(OWNER)
  })

  it('answers an empty list as []', async () => {
    accounts.list.mockResolvedValue([])

    await send('get', '/api/accounts').expect(200, [])
  })

  it('answers 401 without a token and does not run the service', async () => {
    await anonymous('get', '/api/accounts').expect(401)

    expect(calls()).toBe(0)
  })
})
