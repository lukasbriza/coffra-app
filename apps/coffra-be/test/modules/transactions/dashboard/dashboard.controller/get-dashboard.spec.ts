import { describe, expect, it } from 'vitest'

import { OWNER, useDashboardController, VIEW } from './setup'

describe('GET /api/dashboard', () => {
  const { dashboard, send, anonymous, calls } = useDashboardController()

  /** What the service got as the query: an object with the `period` of the request, if any. */
  const queryOfTheCall = (): { period?: string } | undefined => dashboard.get.mock.calls[0]?.[1]

  it('answers 200 with the dashboard of the owner of the token', async () => {
    const response = await send('get', '/api/dashboard').expect(200)

    expect(response.body).toStrictEqual(VIEW)
    expect(dashboard.get).toHaveBeenCalledExactlyOnceWith(OWNER, expect.objectContaining({}))
  })

  it('answers 401 without a token and does not run the service', async () => {
    await anonymous('get', '/api/dashboard').expect(401)

    expect(calls()).toBe(0)
  })

  it('takes the owner from the token only: nothing in the query can choose another one', async () => {
    await send('get', '/api/dashboard?userId=someone-else&owner=someone-else').expect(200)

    expect(dashboard.get.mock.calls[0]?.[0]).toStrictEqual(OWNER)
  })

  describe('period', () => {
    it('is left to the service when not given', async () => {
      await send('get', '/api/dashboard').expect(200)

      expect(queryOfTheCall()?.period).toBeUndefined()
    })

    it.each(['3m', '6m', '1y'])('hands the period %s to the service as it came', async (period) => {
      await send('get', `/api/dashboard?period=${period}`).expect(200)

      expect(queryOfTheCall()?.period).toBe(period)
    })

    it.each(['2m', '12m', '1m', '3M', '1Y', '6 m', ' 3m', '3m ', '90d', 'year', '1', '3', '0', '-3m', '', '%20'])(
      'answers 400 for the value %j, before the service runs',
      async (period) => {
        const response = await send('get', `/api/dashboard?period=${encodeURIComponent(period)}`).expect(400)

        expect((response.body as { message: string[] }).message).toEqual([
          'period must be one of the following values: 3m, 6m, 1y',
        ])
        expect(calls()).toBe(0)
      },
    )

    it.each(['/api/dashboard?period=3m&period=6m', '/api/dashboard?period=3m&period=3m'])(
      'answers 400 when it is given more than once: %s',
      async (path) => {
        await send('get', path).expect(400)

        expect(calls()).toBe(0)
      },
    )

    // The query parser of Express 5 is the simple one: `period[]` and `period[a]` are other parameters, not a list or an
    // object under `period`, so they are unknown and dropped like any other.
    it.each(['/api/dashboard?period[]=1y', '/api/dashboard?period[a]=1y'])(
      'drops %s as an unknown parameter instead of reading it as a period',
      async (path) => {
        await send('get', path).expect(200)

        expect(queryOfTheCall()?.period).toBeUndefined()
      },
    )

    it('drops a parameter it does not know: a misspelt one counts as the default period', async () => {
      await send('get', '/api/dashboard?perod=1y&from=2020-01-01&to=2020-12-31').expect(200)

      expect(queryOfTheCall()?.period).toBeUndefined()
      expect(queryOfTheCall()).not.toHaveProperty('from')
      expect(queryOfTheCall()).not.toHaveProperty('to')
    })
  })
})
