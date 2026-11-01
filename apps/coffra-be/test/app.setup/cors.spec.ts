import { describe, expect, it } from 'vitest'

import { useHttpApp } from './setup'

const ORIGIN = 'https://coffra.example.com'
const ANOTHER = 'http://localhost:5173'

/** Every header a CORS answer may carry. */
const CORS_HEADERS = [
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'access-control-allow-methods',
  'access-control-allow-headers',
  'access-control-expose-headers',
  'access-control-max-age',
]

const preflight = {
  'Access-Control-Request-Method': 'PATCH',
  'Access-Control-Request-Headers': 'authorization,content-type',
}

describe('CORS', () => {
  describe('without origins in the environment', () => {
    const app = useHttpApp()

    it.each([ORIGIN, 'null'])('sends no CORS header to a request from %s', async (origin) => {
      const response = await app.get('/api/probe', { Origin: origin }).expect(200)

      for (const header of CORS_HEADERS) {
        expect(response.headers[header], header).toBeUndefined()
      }
    })

    it('does not answer a preflight with a permission', async () => {
      const response = await app.options('/api/probe', { Origin: ORIGIN, ...preflight })

      for (const header of CORS_HEADERS) {
        expect(response.headers[header], header).toBeUndefined()
      }
    })
  })

  describe('with origins in the environment', () => {
    const app = useHttpApp({ corsOrigins: [ORIGIN, ANOTHER] })

    it.each([ORIGIN, ANOTHER])('lets the browser at %s read the answer, and only that origin', async (origin) => {
      const response = await app.get('/api/probe', { Origin: origin }).expect(200)

      expect(response.headers['access-control-allow-origin']).toBe(origin)
      expect(response.headers.vary).toContain('Origin')
    })

    it('never allows credentials: the tokens are in the body and in `Authorization`', async () => {
      const response = await app.get('/api/probe', { Origin: ORIGIN }).expect(200)

      expect(response.headers['access-control-allow-credentials']).toBeUndefined()
    })

    it.each([
      ['an origin that is not on the list', 'https://evil.example.com'],
      ['the opaque origin', 'null'],
      ['the allowed host in another case', 'https://COFFRA.example.com'],
      ['the allowed host with a trailing slash', `${ORIGIN}/`],
      ['the allowed host on another port', 'https://coffra.example.com:8443'],
      // Built, not written: the linter rewrites a literal `http://` to `https://` (except for localhost).
      ['the allowed host on plain http', ORIGIN.replace('https:', 'http:')],
      ['a host that only starts like an allowed one', 'https://coffra.example.com.evil.example'],
    ])('sends nothing to %s', async (_name, origin) => {
      const response = await app.get('/api/probe', { Origin: origin }).expect(200)

      expect(response.headers['access-control-allow-origin']).toBeUndefined()
    })

    it('sends nothing without an Origin header (a client that is not a browser)', async () => {
      const response = await app.get('/api/probe').expect(200)

      expect(response.headers['access-control-allow-origin']).toBeUndefined()
    })

    it('answers the preflight of an allowed origin with the methods and the headers the API has', async () => {
      const response = await app.options('/api/probe', { Origin: ORIGIN, ...preflight }).expect(204)

      expect(response.headers['access-control-allow-origin']).toBe(ORIGIN)
      expect(response.headers['access-control-allow-methods']).toBe('GET,POST,PATCH,DELETE')
      expect(response.headers['access-control-allow-headers']).toBe('Authorization,Content-Type')
      expect(response.headers['access-control-max-age']).toBe('600')
    })

    it('does not answer the preflight of another origin with a permission', async () => {
      const response = await app.options('/api/probe', { Origin: 'https://evil.example.com', ...preflight })

      // The permission is `Access-Control-Allow-Origin`: without it the browser refuses the real request, whatever
      // else the answer lists (the `cors` package lists the methods for every origin).
      expect(response.headers['access-control-allow-origin']).toBeUndefined()
      expect(response.headers['access-control-allow-credentials']).toBeUndefined()
    })

    it('does not offer a method or a header the API does not use', async () => {
      const response = await app
        .options('/api/probe', {
          Origin: ORIGIN,
          'Access-Control-Request-Method': 'PUT',
          'Access-Control-Request-Headers': 'x-custom',
        })
        .expect(204)

      expect(response.headers['access-control-allow-methods']).not.toContain('PUT')
      expect(response.headers['access-control-allow-headers']).not.toContain('x-custom')
    })

    it('lets the allowed browser read a 401 and a 404 too, so a client can tell why it failed', async () => {
      const turnedAway = await app.get('/api/private', { Origin: ORIGIN }).expect(401)
      const missing = await app.get('/api/nothing-here', { Origin: ORIGIN }).expect(404)

      expect(turnedAway.headers['access-control-allow-origin']).toBe(ORIGIN)
      expect(missing.headers['access-control-allow-origin']).toBe(ORIGIN)
    })

    it('lets the browser read the headers that say how long to wait after a 429', async () => {
      const response = await app.get('/api/probe', { Origin: ORIGIN }).expect(200)

      expect(response.headers['access-control-expose-headers']).toBe(
        'Retry-After,X-RateLimit-Limit,X-RateLimit-Remaining,X-RateLimit-Reset',
      )
    })
  })
})
