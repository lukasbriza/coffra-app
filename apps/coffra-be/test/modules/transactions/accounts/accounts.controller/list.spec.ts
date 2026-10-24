import { describe, expect, it } from 'vitest'

import { OWNER, useAccountsController, VIEW } from './setup'

describe('GET /api/accounts', () => {
  const { accounts, send, anonymous, calls } = useAccountsController()

  /** What the service got as the query of the balance: an object with the `asOf` of the request, if any. */
  const queryOfTheCall = (): { asOf?: string } | undefined => accounts.list.mock.calls[0]?.[1]

  it('answers 200 with the accounts of the owner of the token', async () => {
    const response = await send('get', '/api/accounts').expect(200)

    expect(response.body).toStrictEqual([VIEW])
    expect(accounts.list).toHaveBeenCalledExactlyOnceWith(OWNER, expect.objectContaining({}))
  })

  it('answers every account with its balance', async () => {
    const response = await send('get', '/api/accounts').expect(200)

    expect((response.body as { balance: string }[]).map(({ balance }) => balance)).toEqual(['4500.5500'])
  })

  it('answers an empty list as []', async () => {
    accounts.list.mockResolvedValue([])

    await send('get', '/api/accounts').expect(200, [])
  })

  describe('asOf', () => {
    it('is left to the service when not given', async () => {
      await send('get', '/api/accounts').expect(200)

      expect(queryOfTheCall()?.asOf).toBeUndefined()
    })

    it.each(['2026-10-22', '2027-01-31', '2024-02-29', '0001-01-01', '9999-12-31'])(
      'hands the day %s to the service as it came',
      async (asOf) => {
        await send('get', `/api/accounts?asOf=${asOf}`).expect(200)

        expect(queryOfTheCall()?.asOf).toBe(asOf)
      },
    )

    it.each([
      '2026-02-30',
      '2026-13-01',
      '2026-10-22T10:00:00Z',
      '2026-1-5',
      '22.10.2026',
      '0000-01-01',
      'today',
      '',
      '%20',
    ])('answers 400 for the value %j, before the service runs', async (asOf) => {
      const response = await send('get', `/api/accounts?asOf=${encodeURIComponent(asOf)}`).expect(400)

      expect((response.body as { message: string[] }).message).toEqual(['asOf must be a calendar date YYYY-MM-DD'])
      expect(calls()).toBe(0)
    })

    it('answers 400 when it is given twice', async () => {
      await send('get', '/api/accounts?asOf=2026-10-22&asOf=2026-10-23').expect(400)

      expect(calls()).toBe(0)
    })

    it('drops a parameter it does not know: a misspelt one counts to today', async () => {
      await send('get', '/api/accounts?asof=2026-01-01').expect(200)

      expect(queryOfTheCall()?.asOf).toBeUndefined()
    })
  })

  it('answers 401 without a token and does not run the service', async () => {
    await anonymous('get', '/api/accounts').expect(401)

    expect(calls()).toBe(0)
  })
})
