import { describe, expect, it } from 'vitest'

import { useRateLimitApp } from './setup'

describe('the global limit', () => {
  const app = useRateLimitApp({ ttlSeconds: 60, max: 3, authMax: 2 })

  it('answers the requests up to the limit and tells how much of it is left', async () => {
    const first = await app.get('/plain').expect(200)
    const second = await app.get('/plain').expect(200)
    const third = await app.get('/plain').expect(200)

    expect(first.headers['x-ratelimit-limit']).toBe('3')
    expect([first, second, third].map((response) => response.headers['x-ratelimit-remaining'])).toStrictEqual([
      '2',
      '1',
      '0',
    ])
  })

  it('answers the request over the limit with 429 and how long to wait', async () => {
    await app.get('/plain').expect(200)
    await app.get('/plain').expect(200)
    await app.get('/plain').expect(200)

    const response = await app.get('/plain').expect(429)

    expect(response.body).toStrictEqual({ statusCode: 429, message: 'ThrottlerException: Too Many Requests' })
    // The clock stands still, so the wait is exactly the window: the block of the library, not a pause of Redis.
    expect(response.headers['retry-after']).toBe('60')
  })

  it('counts every plain route in the same bucket', async () => {
    await app.get('/plain').expect(200)
    await app.get('/plain/other').expect(200)
    await app.get('/plain/who').expect(200)

    await app.get('/plain').expect(429)
    await app.get('/plain/other').expect(429)
    await app.get('/plain/who').expect(429)
  })

  it('lets the client in again when the window has passed, not before', async () => {
    await app.get('/plain').expect(200)
    await app.get('/plain').expect(200)
    await app.get('/plain').expect(200)
    await app.get('/plain').expect(429)

    app.travel(30)
    await app.get('/plain').expect(429)

    app.travel(31)
    await app.get('/plain').expect(200)
  })
})
