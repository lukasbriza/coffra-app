import { describe, expect, it } from 'vitest'

import { useHttpApp } from './setup'

// `req.ip` is what the rate limit counts. Whether `X-Forwarded-For` is believed, and how far, is the whole point of
// `TRUST_PROXY_HOPS`: believed too little, every client is the proxy; believed too much, a client chooses its address.

/** The address the app sees, with the given forwarded header (or none). */
const ipOf = async (get: ReturnType<typeof useHttpApp>['get'], forwarded?: string): Promise<string> => {
  const response = await get('/api/probe/who', forwarded === undefined ? {} : { 'X-Forwarded-For': forwarded })

  return (response.body as { ip: string }).ip
}

describe('the client address', () => {
  describe('without a trusted proxy', () => {
    const app = useHttpApp({ trustProxyHops: 0 })

    it('is the address of the connection, whatever X-Forwarded-For says', async () => {
      const connection = await ipOf(app.get)

      expect(await ipOf(app.get, '203.0.113.9')).toBe(connection)
      expect(await ipOf(app.get, '198.51.100.7, 203.0.113.9')).toBe(connection)
    })
  })

  describe('behind one trusted proxy', () => {
    const app = useHttpApp({ trustProxyHops: 1 })

    it('is the address the proxy wrote', async () => {
      expect(await ipOf(app.get, '203.0.113.9')).toBe('203.0.113.9')
    })

    it('is the last entry of the header: what the client wrote in front of it does not count', async () => {
      expect(await ipOf(app.get, '10.0.0.1, 203.0.113.9')).toBe('203.0.113.9')
      expect(await ipOf(app.get, '10.0.0.2, 10.0.0.3, 203.0.113.9')).toBe('203.0.113.9')
    })

    it('is the address of the connection when there is no header', async () => {
      expect(await ipOf(app.get)).toMatch(/127\.0\.0\.1$|^::1$/)
    })
  })

  describe('behind two trusted proxies', () => {
    const app = useHttpApp({ trustProxyHops: 2 })

    it('is the address the outer proxy wrote, the one before the last entry', async () => {
      expect(await ipOf(app.get, '198.51.100.7, 203.0.113.9')).toBe('198.51.100.7')
    })

    it('is not moved by what the client wrote in front of that', async () => {
      expect(await ipOf(app.get, '10.0.0.1, 198.51.100.7, 203.0.113.9')).toBe('198.51.100.7')
    })
  })
})
