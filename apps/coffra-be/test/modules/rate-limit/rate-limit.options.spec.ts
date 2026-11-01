import { Controller, type ExecutionContext, Get } from '@nestjs/common'
import type { ConfigService } from '@nestjs/config'
import type { ThrottlerOptions } from '@nestjs/throttler'
import { describe, expect, it } from 'vitest'

import type { Env } from '../../../src/modules/config'
import { StrictRateLimit } from '../../../src/modules/rate-limit'
import { createRateLimitOptions } from '../../../src/modules/rate-limit/rate-limit.options'

const values = { RATE_LIMIT_TTL_SECONDS: 60, RATE_LIMIT_MAX: 120, RATE_LIMIT_AUTH_MAX: 10 }
const config = { get: (key: keyof typeof values) => values[key] } as unknown as ConfigService<Env, true>

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

/** The part of the call the options look at. */
const callTo = (controller: new () => object, method: string): ExecutionContext =>
  ({
    getClass: () => controller,
    getHandler: () => (controller.prototype as Record<string, () => string>)[method],
  }) as unknown as ExecutionContext

const options = () => {
  const built = createRateLimitOptions(config)

  if (Array.isArray(built)) {
    throw new TypeError('the options are expected as an object')
  }
  const [throttler] = built.throttlers as [ThrottlerOptions]

  return {
    throttlers: built.throttlers,
    throttler,
    generateKey: built.generateKey,
    limit: throttler.limit as (context: ExecutionContext) => number,
  }
}

const keyOf = (controller: new () => object, method: string): string | undefined =>
  options().generateKey?.(callTo(controller, method), '203.0.113.1', 'default')

describe('createRateLimitOptions', () => {
  it('has one unnamed throttler, so the answers carry the plain header names', () => {
    expect(options().throttlers).toHaveLength(1)
    expect(options().throttler.name).toBeUndefined()
  })

  it('turns the window from seconds into milliseconds, which is what the library counts in', () => {
    expect(options().throttler.ttl).toBe(60_000)
  })

  it('gives a plain route the global limit', () => {
    expect(options().limit(callTo(PlainController, 'index'))).toBe(120)
  })

  it('gives a strict route the strict limit, whether the decorator is on the class or on the method', () => {
    expect(options().limit(callTo(StrictController, 'index'))).toBe(10)
    expect(options().limit(callTo(PlainController, 'marked'))).toBe(10)
  })

  it('keys the strict and the global bucket apart, per client', () => {
    expect(keyOf(PlainController, 'index')).toBe('global:203.0.113.1')
    expect(keyOf(StrictController, 'index')).toBe('auth:203.0.113.1')
  })

  it('leaves the controller and the method out of the key, so the routes of a bucket add up', () => {
    expect(keyOf(PlainController, 'index')).toBe(keyOf(PlainController, 'other'))
    expect(keyOf(PlainController, 'index')).toBe(keyOf(AnotherController, 'index'))
    expect(keyOf(StrictController, 'index')).toBe(keyOf(StrictController, 'second'))
    expect(keyOf(StrictController, 'index')).toBe(keyOf(PlainController, 'marked'))
  })

  it('keeps clients apart in the key', () => {
    const { generateKey } = options()

    expect(generateKey?.(callTo(PlainController, 'index'), '203.0.113.2', 'default')).toBe('global:203.0.113.2')
  })
})
