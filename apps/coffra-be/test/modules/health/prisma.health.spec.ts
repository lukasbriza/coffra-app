import 'reflect-metadata'

import { Logger } from '@nestjs/common'
import { HealthIndicatorService } from '@nestjs/terminus'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PrismaHealthIndicator } from '../../../src/modules/health/prisma.health'
import type { PrismaService } from '../../../src/modules/prisma/prisma.service'

const build = (queryRaw: () => Promise<unknown>) => {
  const prisma = { $queryRaw: vi.fn(queryRaw) } as unknown as PrismaService
  return new PrismaHealthIndicator(new HealthIndicatorService(), prisma)
}

describe('PrismaHealthIndicator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports up when the query succeeds', async () => {
    const result = await build(() => Promise.resolve([{ '?column?': 1 }])).isHealthy('database')

    expect(result).toEqual({ database: { status: 'up' } })
  })

  it('reports down without leaking the error text, and logs that the check failed', async () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {
      // the failure is expected here: the spec checks the log instead of printing it as an ERROR
    })

    const result = await build(() =>
      Promise.reject(new Error('connect ECONNREFUSED postgresql://coffra:secret@db:5432')),
    ).isHealthy('database')

    expect(result).toEqual({ database: { status: 'down' } })
    expect(JSON.stringify(result)).not.toContain('secret')
    expect(error).toHaveBeenCalledExactlyOnceWith(expect.stringMatching(/^Database check failed: /))
  })
})
