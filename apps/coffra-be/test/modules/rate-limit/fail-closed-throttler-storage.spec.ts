import { Logger, ServiceUnavailableException } from '@nestjs/common'
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'

import { REDIS_PAUSE_MS } from '../../../src/modules/rate-limit/constants'
import { FailClosedThrottlerStorage } from '../../../src/modules/rate-limit/fail-closed-throttler-storage'

const RECORD = { totalHits: 1, timeToExpire: 60, isBlocked: false, timeToBlockExpire: 0 }

/** Stands in for `RedisThrottlerStorage`. */
const redisStorage = { increment: vi.fn() }

/** An error like the ones ioredis raises: a code, and a message with a password the log must not show. */
const redisError = (): Error =>
  Object.assign(new Error('connect ECONNREFUSED redis://:hunter2@10.0.0.5:6379'), { code: 'ECONNREFUSED' })

const increment = (storage: FailClosedThrottlerStorage) =>
  storage.increment('auth:203.0.113.1', 60_000, 10, 60_000, 'default')

const expectRefused = async (storage: FailClosedThrottlerStorage): Promise<void> => {
  await expect(increment(storage)).rejects.toBeInstanceOf(ServiceUnavailableException)
}

/** Moves the clock forward by `milliseconds`. */
const wait = (milliseconds: number): void => {
  vi.setSystemTime(Date.now() + milliseconds)
}

describe('FailClosedThrottlerStorage', () => {
  let storage: FailClosedThrottlerStorage
  let error: MockInstance<Logger['error']>
  let log: MockInstance<Logger['log']>

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-01T12:00:00.000Z'))
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {
      // collected and asserted by the tests
    })
    log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {
      // collected and asserted by the tests
    })
    redisStorage.increment.mockReset().mockResolvedValue(RECORD)
    storage = new FailClosedThrottlerStorage(redisStorage)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('while Redis answers', () => {
    it('counts in Redis, with the arguments it was given, and logs nothing', async () => {
      expect(await increment(storage)).toStrictEqual(RECORD)

      expect(redisStorage.increment).toHaveBeenCalledExactlyOnceWith('auth:203.0.113.1', 60_000, 10, 60_000, 'default')
      expect(error).not.toHaveBeenCalled()
      expect(log).not.toHaveBeenCalled()
    })
  })

  describe('when Redis fails', () => {
    beforeEach(() => {
      redisStorage.increment.mockRejectedValueOnce(redisError())
    })

    it('refuses the request with 503, never lets it through', async () => {
      await expectRefused(storage)
    })

    it('logs once, with the kind of the error but not its message, which can hold a password', async () => {
      await expectRefused(storage)

      expect(error).toHaveBeenCalledExactlyOnceWith(
        'Redis failed (Error ECONNREFUSED), requests are refused with 503 until it answers',
      )
      expect(String(error.mock.calls[0])).not.toContain('hunter2')
    })

    it('during the pause refuses at once without asking Redis, so a Redis that hangs slows nothing down', async () => {
      await expectRefused(storage)

      wait(REDIS_PAUSE_MS - 1)
      await expectRefused(storage)

      expect(redisStorage.increment).toHaveBeenCalledOnce()
      expect(error).toHaveBeenCalledOnce()
    })

    it('after the pause asks Redis again, counts again when it answers, and logs the recovery once', async () => {
      await expectRefused(storage)

      wait(REDIS_PAUSE_MS)
      const recovered = await increment(storage)
      await increment(storage)

      expect(recovered).toStrictEqual(RECORD)
      expect(redisStorage.increment).toHaveBeenCalledTimes(3)
      expect(log).toHaveBeenCalledExactlyOnceWith('Redis answers again, requests are counted again')
    })

    it('pauses again when Redis still fails, without logging a second time', async () => {
      await expectRefused(storage)
      redisStorage.increment.mockRejectedValueOnce(redisError())

      wait(REDIS_PAUSE_MS)
      await expectRefused(storage)
      await expectRefused(storage)

      expect(redisStorage.increment).toHaveBeenCalledTimes(2)
      expect(error).toHaveBeenCalledOnce()
      expect(log).not.toHaveBeenCalled()
    })

    it('logs again when Redis fails a second time after it recovered', async () => {
      await expectRefused(storage)
      wait(REDIS_PAUSE_MS)
      await increment(storage)
      redisStorage.increment.mockRejectedValueOnce(redisError())

      await expectRefused(storage)

      expect(error).toHaveBeenCalledTimes(2)
    })
  })
})
