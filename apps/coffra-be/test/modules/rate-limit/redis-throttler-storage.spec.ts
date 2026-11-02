import type { Redis } from 'ioredis'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { INCREMENT_SCRIPT, RedisThrottlerStorage } from '../../../src/modules/rate-limit/redis-throttler-storage'

// What the storage sends to Redis and what it makes of the answer. What the script does inside Redis (the window, the
// block, the same rules as the in-memory store) is proven against a real Redis in `test/integration/rate-limit/`.

/** A fake Redis client: only what the storage calls. */
const redis = {
  defineCommand: vi.fn(),
  rateLimitIncrement: vi.fn(),
}

/** The hash slot of a Redis key: what is in the braces. */
const slotOf = (key: string): string => /\{(.*)\}/u.exec(key)?.[1] ?? ''

const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/u

describe('RedisThrottlerStorage', () => {
  let storage: RedisThrottlerStorage

  beforeEach(() => {
    redis.defineCommand.mockReset()
    redis.rateLimitIncrement.mockReset().mockResolvedValue([1, 60_000, 0, 0])
    storage = new RedisThrottlerStorage(redis as unknown as Redis)
  })

  it('registers the script as a command with two keys on the connection it is given', () => {
    expect(redis.defineCommand).toHaveBeenCalledExactlyOnceWith('rateLimitIncrement', {
      numberOfKeys: 2,
      lua: INCREMENT_SCRIPT,
    })
  })

  describe('increment', () => {
    it('sends the keys, the limits and an id of the hit to the script', async () => {
      await storage.increment('auth:203.0.113.1', 60_000, 10, 60_000, 'default')

      expect(redis.rateLimitIncrement).toHaveBeenCalledExactlyOnceWith(
        'coffra:rate-limit:{auth:203.0.113.1:default}:hits',
        'coffra:rate-limit:{auth:203.0.113.1:default}:block',
        60_000,
        10,
        60_000,
        expect.stringMatching(UUID),
      )
    })

    it('keeps the two keys in one hash slot (the braces), so the script also runs on a cluster', async () => {
      await storage.increment('global:203.0.113.1', 1000, 5, 1000, 'default')

      const [hitsKey, blockKey] = redis.rateLimitIncrement.mock.calls[0] as [string, string]
      expect(slotOf(hitsKey)).toBe('global:203.0.113.1:default')
      expect(slotOf(blockKey)).toBe(slotOf(hitsKey))
    })

    it('keeps throttlers and clients apart in the keys', async () => {
      await storage.increment('global:one', 1000, 5, 1000, 'default')
      await storage.increment('global:one', 1000, 5, 1000, 'second')
      await storage.increment('global:two', 1000, 5, 1000, 'default')

      const hitsKeys = redis.rateLimitIncrement.mock.calls.map(([hitsKey]) => hitsKey as string)
      expect(hitsKeys).toStrictEqual([
        'coffra:rate-limit:{global:one:default}:hits',
        'coffra:rate-limit:{global:one:second}:hits',
        'coffra:rate-limit:{global:two:default}:hits',
      ])
    })

    it('gives every hit its own id, otherwise two hits in one millisecond would count as one', async () => {
      await storage.increment('global:one', 1000, 5, 1000, 'default')
      await storage.increment('global:one', 1000, 5, 1000, 'default')

      const [first, second] = redis.rateLimitIncrement.mock.calls.map((call) => call[5] as string)
      expect(first).not.toBe(second)
    })

    it('converts the times of the answer from milliseconds to whole seconds, rounded up', async () => {
      redis.rateLimitIncrement.mockResolvedValue([3, 1500, 0, 0])

      expect(await storage.increment('k', 60_000, 5, 60_000, 'default')).toStrictEqual({
        totalHits: 3,
        timeToExpire: 2,
        isBlocked: false,
        timeToBlockExpire: 0,
      })
    })

    it('reports a blocked client with the wait in seconds', async () => {
      redis.rateLimitIncrement.mockResolvedValue([11, 59_200, 1, 59_200])

      expect(await storage.increment('k', 60_000, 10, 60_000, 'default')).toStrictEqual({
        totalHits: 11,
        timeToExpire: 60,
        isBlocked: true,
        timeToBlockExpire: 60,
      })
    })

    it.each([
      ['nothing', null],
      ['a status', 'OK'],
      ['too few values', [1, 2, 3]],
      ['too many values', [1, 2, 3, 4, 5]],
      ['a value that is not a number', [1, 2, 3, '4']],
    ])('throws on an answer of %s, so the request is refused instead of counted on a guess', async (_name, reply) => {
      redis.rateLimitIncrement.mockResolvedValue(reply)

      await expect(storage.increment('k', 1000, 5, 1000, 'default')).rejects.toThrow(
        'Unexpected reply of the rate limit script',
      )
    })

    it('passes the error of Redis on', async () => {
      redis.rateLimitIncrement.mockRejectedValue(new Error('Command timed out'))

      await expect(storage.increment('k', 1000, 5, 1000, 'default')).rejects.toThrow('Command timed out')
    })
  })
})
