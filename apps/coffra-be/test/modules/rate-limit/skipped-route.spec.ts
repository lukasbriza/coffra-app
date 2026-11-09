import { describe, expect, it } from 'vitest'

import { useRateLimitApp } from './setup'

describe('a route outside the limit', () => {
  const app = useRateLimitApp({ ttlSeconds: 60, max: 3, authMax: 2 })

  it('is answered however often it is called, and carries no limit headers', async () => {
    for (let call = 0; call < 8; call += 1) {
      const response = await app.get('/skipped').expect(200)

      expect(response.headers['x-ratelimit-limit']).toBeUndefined()
    }
  })

  it('does not use up the limit of the other routes', async () => {
    for (let call = 0; call < 5; call += 1) {
      await app.get('/skipped').expect(200)
    }

    await app.get('/plain').expect(200)
    await app.get('/plain').expect(200)
    await app.get('/plain').expect(200)
    await app.get('/plain').expect(429)
  })

  it('is still answered when the limit of the others is used up', async () => {
    await app.get('/plain').expect(200)
    await app.get('/plain').expect(200)
    await app.get('/plain').expect(200)
    await app.get('/plain').expect(429)

    await app.get('/skipped').expect(200)
  })
})
