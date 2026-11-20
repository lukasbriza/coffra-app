import { Logger } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import { infrastructure, useHttpApp } from './setup'

type HealthBody = {
  status: string
  info?: { database?: { status: string }; redis?: { status: string } }
  error?: { database?: { status: string }; redis?: { status: string } }
}

/** Keeps the expected failure of a check out of the test output; the spec reads the log instead. */
const quietErrors = () =>
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {
    // expected here: a check fails on purpose
  })

describe('GET /api/health', () => {
  const app = useHttpApp()

  it('returns 200 when the database and Redis are up, and names both', async () => {
    const response = await app.get('/api/health').expect(200)

    const body = response.body as HealthBody
    expect(body.status).toBe('ok')
    expect(body.info?.database?.status).toBe('up')
    expect(body.info?.redis?.status).toBe('up')
  })

  it('returns 503 when the database is down, with the reason in the log only', async () => {
    const error = quietErrors()
    infrastructure.queryRaw.mockRejectedValue(new Error('connection refused'))

    const response = await app.get('/api/health').expect(503)

    const body = response.body as HealthBody
    expect(body.status).toBe('error')
    expect(body.error?.database?.status).toBe('down')
    expect(JSON.stringify(body)).not.toContain('connection refused')
    expect(error).toHaveBeenCalledWith('Database check failed: connection refused')
  })

  it('returns 503 when Redis is down: it is a required service, like the database', async () => {
    const error = quietErrors()
    infrastructure.ping.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }))

    const response = await app.get('/api/health').expect(503)

    const body = response.body as HealthBody
    expect(body.error?.redis?.status).toBe('down')
    expect(body.info?.database?.status).toBe('up')
    expect(error).toHaveBeenCalledWith('Redis check failed: Error ECONNREFUSED')
  })

  it('is not served without the api prefix', async () => {
    await app.get('/health').expect(404)
  })
})
