import 'reflect-metadata'

import { HealthIndicatorService } from '@nestjs/terminus'
import { describe, expect, it, vi } from 'vitest'

import { PrismaHealthIndicator } from '../src/modules/health/prisma.health'
import type { PrismaService } from '../src/modules/prisma/prisma.service'

const build = (queryRaw: () => Promise<unknown>) => {
  const prisma = { $queryRaw: vi.fn(queryRaw) } as unknown as PrismaService
  return new PrismaHealthIndicator(new HealthIndicatorService(), prisma)
}

describe('PrismaHealthIndicator', () => {
  it('reports up when the query succeeds', async () => {
    const result = await build(() => Promise.resolve([{ '?column?': 1 }])).isHealthy('database')

    expect(result).toEqual({ database: { status: 'up' } })
  })

  it('reports down without leaking the error text', async () => {
    const result = await build(() =>
      Promise.reject(new Error('connect ECONNREFUSED postgresql://coffra:secret@db:5432')),
    ).isHealthy('database')

    expect(result).toEqual({ database: { status: 'down' } })
    expect(JSON.stringify(result)).not.toContain('secret')
  })
})
