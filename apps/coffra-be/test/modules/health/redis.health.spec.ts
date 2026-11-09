import 'reflect-metadata'

import { Logger } from '@nestjs/common'
import { HealthIndicatorService } from '@nestjs/terminus'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RedisHealthIndicator } from '../../../src/modules/health/redis.health'
import type { RedisService } from '../../../src/modules/redis'

const build = (ping: () => Promise<unknown>) => {
  const redis = { ping: vi.fn(ping) } as unknown as RedisService
  return new RedisHealthIndicator(new HealthIndicatorService(), redis)
}

describe('RedisHealthIndicator', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports up when Redis answers PING', async () => {
    const result = await build(() => Promise.resolve('PONG')).isHealthy('redis')

    expect(result).toEqual({ redis: { status: 'up' } })
  })

  it('reports down without leaking the error, and logs only its class and code', async () => {
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {
      // the failure is expected here: the spec checks the log instead of printing it as an ERROR
    })
    const failure = Object.assign(new Error('connect ECONNREFUSED redis://:hunter2@10.0.0.5:6379'), {
      code: 'ECONNREFUSED',
    })

    const result = await build(() => Promise.reject(failure)).isHealthy('redis')

    expect(result).toEqual({ redis: { status: 'down' } })
    expect(error).toHaveBeenCalledExactlyOnceWith('Redis check failed: Error ECONNREFUSED')
  })
})
