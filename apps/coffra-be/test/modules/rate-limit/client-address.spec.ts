import { describe, expect, it } from 'vitest'

import { useRateLimitApp } from './setup'

// The limit counts `req.ip`, so what `TRUST_PROXY_HOPS` makes of `X-Forwarded-For` decides who is limited: a client
// that picks its own address must not escape the limit, and the clients behind one proxy must not share one.

const LIMITS = { ttlSeconds: 60, max: 3, authMax: 2 }

describe('which client the limit counts', () => {
  describe('without a trusted proxy', () => {
    const app = useRateLimitApp(LIMITS)

    it('ignores X-Forwarded-For, so a client cannot leave its bucket by writing another address', async () => {
      await app.get('/plain', { 'X-Forwarded-For': '203.0.113.1' }).expect(200)
      await app.get('/plain', { 'X-Forwarded-For': '203.0.113.2' }).expect(200)
      await app.get('/plain', { 'X-Forwarded-For': '203.0.113.3' }).expect(200)

      await app.get('/plain', { 'X-Forwarded-For': '203.0.113.4' }).expect(429)
    })
  })

  describe('behind one trusted proxy', () => {
    const app = useRateLimitApp(LIMITS, { trustProxyHops: 1 })

    it('gives every client address its own bucket', async () => {
      await app.get('/plain', { 'X-Forwarded-For': '203.0.113.1' }).expect(200)
      await app.get('/plain', { 'X-Forwarded-For': '203.0.113.1' }).expect(200)
      await app.get('/plain', { 'X-Forwarded-For': '203.0.113.1' }).expect(200)
      await app.get('/plain', { 'X-Forwarded-For': '203.0.113.1' }).expect(429)

      const other = await app.get('/plain', { 'X-Forwarded-For': '203.0.113.2' }).expect(200)

      expect(other.headers['x-ratelimit-remaining']).toBe('2')
    })

    it('counts the address the proxy wrote, not the ones the client put in front of it', async () => {
      await app.get('/plain', { 'X-Forwarded-For': '10.0.0.1, 203.0.113.1' }).expect(200)
      await app.get('/plain', { 'X-Forwarded-For': '10.0.0.2, 203.0.113.1' }).expect(200)
      await app.get('/plain', { 'X-Forwarded-For': '10.0.0.3, 203.0.113.1' }).expect(200)

      await app.get('/plain', { 'X-Forwarded-For': '10.0.0.4, 203.0.113.1' }).expect(429)
    })

    it('keeps the strict bucket per client address too', async () => {
      await app.get('/strict/a', { 'X-Forwarded-For': '203.0.113.1' }).expect(200)
      await app.get('/strict/a', { 'X-Forwarded-For': '203.0.113.1' }).expect(200)
      await app.get('/strict/a', { 'X-Forwarded-For': '203.0.113.1' }).expect(429)

      await app.get('/strict/a', { 'X-Forwarded-For': '203.0.113.2' }).expect(200)
    })
  })
})
