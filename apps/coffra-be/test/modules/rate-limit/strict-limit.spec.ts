import { describe, expect, it } from 'vitest'

import { useRateLimitApp } from './setup'

describe('the strict limit', () => {
  const app = useRateLimitApp({ ttlSeconds: 60, max: 3, authMax: 2 })

  it('answers a strict route up to the lower limit and with 429 after it', async () => {
    const first = await app.get('/strict/a').expect(200)
    await app.get('/strict/a').expect(200)

    expect(first.headers['x-ratelimit-limit']).toBe('2')
    await app.get('/strict/a').expect(429)
  })

  it('counts the strict routes together, whatever the method', async () => {
    await app.get('/strict/a').expect(200)
    await app.post('/strict/b').expect(201)

    await app.get('/strict/a').expect(429)
    await app.post('/strict/b').expect(429)
  })

  it('does not let the strict routes use up the limit of the others', async () => {
    await app.get('/strict/a').expect(200)
    await app.get('/strict/a').expect(200)
    await app.get('/strict/a').expect(429)

    const response = await app.get('/plain').expect(200)

    expect(response.headers['x-ratelimit-limit']).toBe('3')
    expect(response.headers['x-ratelimit-remaining']).toBe('2')
  })

  it('does not let the other routes use up the limit of the strict ones', async () => {
    await app.get('/plain').expect(200)
    await app.get('/plain').expect(200)
    await app.get('/plain').expect(200)
    await app.get('/plain').expect(429)

    const response = await app.get('/strict/a').expect(200)

    expect(response.headers['x-ratelimit-limit']).toBe('2')
    expect(response.headers['x-ratelimit-remaining']).toBe('1')
  })
})
