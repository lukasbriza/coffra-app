import { describe, expect, it } from 'vitest'

import { useHttpApp } from './setup'

// The Swagger UI is a page that loads its own scripts: under the strict policy of the API it would stay empty, so
// under `/api/swagger` only the policy is the default one of `helmet`. The browser is the real proof (the UI loads and
// "Try it out" works); this spec holds what can be held without one: the policy allows exactly what the page uses.

const API_POLICY = "default-src 'none';base-uri 'none';form-action 'none';frame-ancestors 'none'"

/** The default policy of `helmet` without `upgrade-insecure-requests`. */
const SWAGGER_POLICY =
  "default-src 'self';base-uri 'self';font-src 'self' https: data:;form-action 'self';frame-ancestors 'self';img-src 'self' data:;object-src 'none';script-src 'self';script-src-attr 'none';style-src 'self' https: 'unsafe-inline'"

const PAGE = 'http://localhost/api/swagger'

describe('the security headers of the Swagger UI', () => {
  const app = useHttpApp({}, { swagger: true })

  it('has the policy of a page that loads its own scripts, on the page', async () => {
    const response = await app.get('/api/swagger').expect(200)

    expect(response.headers['content-security-policy']).toBe(SWAGGER_POLICY)
  })

  it('does not ask the browser to turn plain http requests into https ones', async () => {
    const response = await app.get('/api/swagger').expect(200)

    expect(response.headers['content-security-policy']).not.toContain('upgrade-insecure-requests')
  })

  it('keeps the other headers of the API on the page', async () => {
    const response = await app.get('/api/swagger').expect(200)

    expect(response.headers['x-content-type-options']).toBe('nosniff')
    expect(response.headers['x-powered-by']).toBeUndefined()
  })

  it('keeps the strict policy on the JSON document and on the rest of the API', async () => {
    const document = await app.get('/api/swagger-json').expect(200)
    const probe = await app.get('/api/probe').expect(200)

    expect(document.headers['content-security-policy']).toBe(API_POLICY)
    expect(probe.headers['content-security-policy']).toBe(API_POLICY)
  })

  describe('the page', () => {
    it("has no script of its own: every script is a file, so `script-src 'self'` is all it needs", async () => {
      const page = await app.get('/api/swagger').expect(200)
      const html = page.text

      const scripts = html.match(/<script\b[^>]*>[\s\S]*?<\/script>/g) ?? []

      expect(scripts.length).toBeGreaterThan(0)
      for (const script of scripts) {
        expect(script).toMatch(/\bsrc=/)
        expect(script.replaceAll(/<script\b[^>]*>|<\/script>/g, '').trim(), 'an inline script').toBe('')
      }
    })

    it('loads every script and style from its own origin, and the files are served under the same policy', async () => {
      const page = await app.get('/api/swagger').expect(200)
      const html = page.text

      const files = [
        ...[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map((match) => match[1]),
        ...[...html.matchAll(/<link\b[^>]*\bhref=["']([^"']+)["']/g)].map((match) => match[1]),
      ]

      expect(files.length).toBeGreaterThan(3)
      for (const file of files) {
        const url = new URL(file, PAGE)

        expect(url.origin, `${file} is from another origin`).toBe('http://localhost')

        const response = await app.get(url.pathname).expect(200)

        expect(response.headers['content-security-policy'], url.pathname).toBe(SWAGGER_POLICY)
      }
    })
  })
})
