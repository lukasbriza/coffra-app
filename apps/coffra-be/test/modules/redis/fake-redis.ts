import { vi } from 'vitest'

import type { RedisService } from '../../../src/modules/redis'

/**
 * A stand-in for `RedisService` in the specs that boot the whole application without Docker (`pnpm test`): `PING`
 * answers, so the health probe is up, and `defineCommand` exists for the storage of the rate limit, which these specs
 * replace or never reach (`withoutRateLimit`, `withMemoryRateLimit`). Nothing is connected to.
 *
 * @returns a new fake, its methods are mocks
 */
export const fakeRedis = () => {
  const fake = {
    ping: vi.fn(() => Promise.resolve('PONG')),
    defineCommand: vi.fn(),
    status: 'ready',
  }

  return fake as typeof fake & RedisService
}
