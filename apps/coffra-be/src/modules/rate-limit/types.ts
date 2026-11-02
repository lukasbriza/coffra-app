import type { ThrottlerStorage } from '@nestjs/throttler'
import type { Redis } from 'ioredis'

/** What a storage answers for one request: the hits in the window, whether the client is blocked, the times in seconds. */
export type StorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>

/**
 * A Redis client with the command `rateLimitIncrement` defined on it (`defineCommand`): the Lua script that counts one
 * request, run in Redis as one step.
 *
 * Its reply is the array `[totalHits, timeToExpire, isBlocked, timeToBlockExpire]`: counts, times in milliseconds,
 * and `isBlocked` as `1` or `0`.
 */
export type RateLimitRedis = Redis & {
  rateLimitIncrement: (
    hitsKey: string,
    blockKey: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    hitId: string,
  ) => Promise<unknown>
}
