import { Controller, type ExecutionContext, Get } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import type { ThrottlerOptions } from '@nestjs/throttler'
import type { Redis } from 'ioredis'
import { describe, expect, it, vi } from 'vitest'

import type { Env } from '../../../src/modules/config'
import { StrictRateLimit } from '../../../src/modules/rate-limit'
import { FailClosedThrottlerStorage } from '../../../src/modules/rate-limit/fail-closed-throttler-storage'
import { createRateLimitOptions } from '../../../src/modules/rate-limit/rate-limit.options'

const values = {
  RATE_LIMIT_TTL_SECONDS: 60,
  RATE_LIMIT_MAX: 120,
  RATE_LIMIT_AUTH_MAX: 10,
}
const config = { get: (key: keyof typeof values) => values[key] } as unknown as ConfigService<Env, true>

/** The client of the app as far as the storage needs it: the script is defined on it, nothing is sent here. */
const defineCommand = vi.fn()
const redis = { defineCommand } as unknown as Redis

@Controller('plain')
class PlainController {
  @Get()
  index(): string {
    return 'index'
  }

  @Get('other')
  other(): string {
    return 'other'
  }

  @Get('marked')
  @StrictRateLimit()
  marked(): string {
    return 'marked'
  }
}

@Controller('another')
class AnotherController {
  @Get()
  index(): string {
    return 'index'
  }
}

@Controller('strict')
@StrictRateLimit()
class StrictController {
  @Get()
  index(): string {
    return 'index'
  }

  @Get('second')
  second(): string {
    return 'second'
  }
}

/** The part of a call the options look at: the controller and the method. */
const callTo = (controller: new () => object, method: string): ExecutionContext =>
  ({
    getClass: () => controller,
    getHandler: () => (controller.prototype as Record<string, () => string>)[method],
  }) as unknown as ExecutionContext

/**
 * Builds the options and checks that they are the object form (`ThrottlerModuleOptions` may also be an array).
 *
 * @returns the options
 */
const build = () => {
  const built = createRateLimitOptions(config, redis)

  if (Array.isArray(built)) {
    throw new TypeError('the options are expected as an object')
  }

  return built
}

const options = build()
const [throttler] = options.throttlers as [ThrottlerOptions]

/** The limit the options give a call to `controller.method`. */
const limitOf = (controller: new () => object, method: string): number =>
  (throttler.limit as (context: ExecutionContext) => number)(callTo(controller, method))

/** The key the options give a call to `controller.method` from `client`. */
const keyOf = (controller: new () => object, method: string, client = '203.0.113.1'): string | undefined =>
  options.generateKey?.(callTo(controller, method), client, 'default')

describe('createRateLimitOptions', () => {
  it('has one unnamed throttler, so the answers carry the plain header names', () => {
    expect(options.throttlers).toHaveLength(1)
    expect(throttler.name).toBeUndefined()
  })

  it('turns the window from seconds into milliseconds, which is what the library counts in', () => {
    expect(throttler.ttl).toBe(60_000)
  })

  it('gives a plain route the global limit', () => {
    expect(limitOf(PlainController, 'index')).toBe(120)
  })

  it('gives a strict route the strict limit, whether the decorator is on the class or on the method', () => {
    expect(limitOf(StrictController, 'index')).toBe(10)
    expect(limitOf(PlainController, 'marked')).toBe(10)
  })

  it('keys the strict and the global bucket apart, per client', () => {
    expect(keyOf(PlainController, 'index')).toBe('global:203.0.113.1')
    expect(keyOf(StrictController, 'index')).toBe('auth:203.0.113.1')
    expect(keyOf(PlainController, 'index', '203.0.113.2')).toBe('global:203.0.113.2')
  })

  it('leaves the controller and the method out of the key, so the routes of a bucket add up', () => {
    expect(keyOf(PlainController, 'index')).toBe(keyOf(PlainController, 'other'))
    expect(keyOf(PlainController, 'index')).toBe(keyOf(AnotherController, 'index'))
    expect(keyOf(StrictController, 'index')).toBe(keyOf(StrictController, 'second'))
    expect(keyOf(StrictController, 'index')).toBe(keyOf(PlainController, 'marked'))
  })

  describe('the storage of the counters', () => {
    it('is Redis, refusing with 503 when it does not answer', () => {
      expect(options.storage).toBeInstanceOf(FailClosedThrottlerStorage)
    })

    it('registers the script of the counters on the client of the app', () => {
      defineCommand.mockClear()

      build()

      expect(defineCommand).toHaveBeenCalledWith('rateLimitIncrement', expect.objectContaining({ numberOfKeys: 2 }))
    })
  })
})
