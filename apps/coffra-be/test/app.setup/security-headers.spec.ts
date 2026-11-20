import { describe, expect, it } from 'vitest'

import { API_CONTENT_SECURITY_POLICY } from '../../src/app.setup'

import { useHttpApp } from './setup'

const API_POLICY = "default-src 'none';base-uri 'none';form-action 'none';frame-ancestors 'none'"

/** The headers every answer of the API carries, whatever the status. */
const SECURITY_HEADERS = {
  'content-security-policy': API_POLICY,
  'x-content-type-options': 'nosniff',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'referrer-policy': 'no-referrer',
  'cross-origin-resource-policy': 'same-origin',
  'cross-origin-opener-policy': 'same-origin',
}

describe('the security headers of the API', () => {
  const app = useHttpApp()

  it('is the strict policy of a service that answers with JSON only', () => {
    expect(API_CONTENT_SECURITY_POLICY).toStrictEqual({
      defaultSrc: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
      frameAncestors: ["'none'"],
    })
  })

  it.each([
    ['an answer', '/probe', 200],
    ['an answer the guard turns away', '/private', 401],
    ['an answer for a route that does not exist', '/nothing-here', 404],
  ])('is on %s', async (_name, path, status) => {
    const response = await app.get(`/api${path}`).expect(status)

    expect(response.headers).toMatchObject(SECURITY_HEADERS)
  })

  it('does not tell what the server runs on', async () => {
    const response = await app.get('/api/probe').expect(200)

    expect(response.headers['x-powered-by']).toBeUndefined()
  })
})
