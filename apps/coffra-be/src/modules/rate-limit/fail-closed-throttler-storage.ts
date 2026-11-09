import { Logger, ServiceUnavailableException } from '@nestjs/common'
import type { ThrottlerStorage } from '@nestjs/throttler'

import { describeError } from '../../utils'

import { REDIS_PAUSE_MS } from './constants'
import type { StorageRecord } from './types'

/**
 * Decides what happens to a request when Redis fails: it is refused with `503`.
 *
 * It wraps `RedisThrottlerStorage`, which does the counting. Without this wrapper a Redis error would end as a `500`
 * on every request. "Fail closed" means that when the limit cannot be checked, the request is refused, never let
 * through uncounted.
 *
 * - **Pause:** after a failure, Redis is not asked for `REDIS_PAUSE_MS`. Requests in that time get `503` at once, so a
 *   Redis that hangs does not slow down every request by its timeout. After the pause Redis is asked again.
 * - **Logging:** only the first failure and the recovery are logged, not every request. The log has the class and the
 *   code of the error, never its message: the message can contain the Redis URL with a password.
 */
export class FailClosedThrottlerStorage implements ThrottlerStorage {
  private readonly logger = new Logger('RateLimit')
  /** Until this moment (`Date.now()`), requests are refused without asking Redis. */
  private pausedUntil = 0
  /** Whether the last call to Redis failed; used to log the failure and the recovery only once. */
  private redisDown = false

  /** @param redisStorage - the storage that counts in Redis */
  constructor(private readonly redisStorage: ThrottlerStorage) {}

  /**
   * Counts one request in Redis.
   *
   * @param key - the bucket and the client
   * @param ttl - the window, in milliseconds
   * @param limit - the requests allowed in a window
   * @param blockDuration - how long a client that went over the limit is blocked, in milliseconds
   * @param throttlerName - the throttler that counts
   * @returns what Redis counted
   * @throws ServiceUnavailableException when Redis failed now or during the pause before
   */
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<StorageRecord> {
    if (Date.now() < this.pausedUntil) {
      throw new ServiceUnavailableException()
    }

    try {
      const record = await this.redisStorage.increment(key, ttl, limit, blockDuration, throttlerName)

      if (this.redisDown) {
        this.redisDown = false
        this.logger.log('Redis answers again, requests are counted again')
      }

      return record
    } catch (error) {
      this.pausedUntil = Date.now() + REDIS_PAUSE_MS

      if (!this.redisDown) {
        this.redisDown = true
        this.logger.error(`Redis failed (${describeError(error)}), requests are refused with 503 until it answers`)
      }

      throw new ServiceUnavailableException()
    }
  }
}
