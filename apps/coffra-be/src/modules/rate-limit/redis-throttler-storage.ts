import { randomUUID } from 'node:crypto'

import type { ThrottlerStorage } from '@nestjs/throttler'
import type { Redis } from 'ioredis'

import { REDIS_KEY_PREFIX } from './constants'
import type { RateLimitRedis, StorageRecord } from './types'

/**
 * Lua script that counts one request of one client. Redis runs a script as one step, nothing else runs in between, so
 * two replicas that count the same client at the same moment never lose a hit.
 *
 * It follows the rules of the in-memory store of `@nestjs/throttler`, so the behaviour is the same as without Redis:
 * - Sliding window: every hit is remembered for `ttl` after it was made.
 * - The request that goes over `limit` blocks the client for `blockDuration`. Requests of a blocked client are not
 *   counted. When the block ends, the client starts from zero.
 * - With `blockDuration` of zero nothing is blocked: a request over the limit is refused until the oldest hit leaves
 *   the window.
 *
 * The time comes from Redis (`TIME`), not from the replica, so replicas with different clocks still agree.
 *
 * Input: `KEYS[1]` the hits (a sorted set, score = time of the hit), `KEYS[2]` the block (exists while the client is
 * blocked); `ARGV` = `ttl`, `limit`, `blockDuration` (milliseconds) and a unique id of this hit.
 * Output: `{ totalHits, timeToExpire, isBlocked (1/0), timeToBlockExpire }`, times in milliseconds.
 */
export const INCREMENT_SCRIPT = `
local hitsKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockDuration = tonumber(ARGV[3])
local hitId = ARGV[4]

-- TIME answers { seconds, microseconds }; now is in milliseconds.
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)

-- A blocked client: refuse it and do not count the request.
local blockedFor = redis.call('PTTL', blockKey)
if blockedFor > 0 then
  return { limit + 1, blockedFor, 1, blockedFor }
end

-- Forget the hits older than the window, count the rest.
redis.call('ZREMRANGEBYSCORE', hitsKey, '-inf', now - ttl)
local hits = redis.call('ZCARD', hitsKey)

-- Milliseconds until the oldest hit leaves the window.
local function untilOldestLeaves()
  local oldest = redis.call('ZRANGE', hitsKey, 0, 0, 'WITHSCORES')
  if #oldest == 0 then
    return ttl
  end
  return tonumber(oldest[2]) + ttl - now
end

-- Without a block: over the limit, refuse and do not count; otherwise count.
if blockDuration <= 0 then
  if hits >= limit then
    local wait = untilOldestLeaves()
    return { hits + 1, wait, 1, wait }
  end
  redis.call('ZADD', hitsKey, now, hitId)
  redis.call('PEXPIRE', hitsKey, ttl)
  return { hits + 1, untilOldestLeaves(), 0, 0 }
end

-- With a block: count the hit first.
redis.call('ZADD', hitsKey, now, hitId)
redis.call('PEXPIRE', hitsKey, ttl)
hits = hits + 1

-- The hit that goes over the limit starts the block and clears the hits.
if hits > limit then
  redis.call('DEL', hitsKey)
  redis.call('SET', blockKey, '1', 'PX', blockDuration)
  return { hits, blockDuration, 1, blockDuration }
end

return { hits, untilOldestLeaves(), 0, 0 }
`

/** What the script returns: `[totalHits, timeToExpire, isBlocked, timeToBlockExpire]`. */
type ScriptReply = [number, number, number, number]

/**
 * Tells whether `reply` is what the script returns: four numbers.
 *
 * @param reply - what Redis answered
 * @returns `true` for four numbers
 */
const isScriptReply = (reply: unknown): reply is ScriptReply =>
  Array.isArray(reply) && reply.length === 4 && reply.every((value) => typeof value === 'number')

/**
 * Converts milliseconds to whole seconds, rounded up (the throttler works in seconds).
 *
 * @param milliseconds - a time from the script
 * @returns the time in seconds
 */
const toSeconds = (milliseconds: number): number => Math.ceil(milliseconds / 1000)

/**
 * Counts the requests in Redis, so every replica of the application shares the same counters.
 *
 * The counting is done by the Lua script `INCREMENT_SCRIPT`. This class only builds the Redis keys, runs the script and
 * converts its answer. What happens when Redis fails is decided by `FailClosedThrottlerStorage`, which wraps this class.
 * The connection belongs to `RedisService`, which also closes it.
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
  private readonly redis: RateLimitRedis

  /** @param client - the Redis connection; the script is registered on it as the command `rateLimitIncrement` */
  constructor(client: Redis) {
    // `defineCommand` sends the script to Redis once and then calls it by its hash (`EVALSHA`).
    client.defineCommand('rateLimitIncrement', { numberOfKeys: 2, lua: INCREMENT_SCRIPT })
    this.redis = client as RateLimitRedis
  }

  /**
   * Counts one request of the client `key`.
   *
   * @param key - the bucket and the client address, e.g. `auth:203.0.113.1` (see `createRateLimitOptions`)
   * @param ttl - the window, in milliseconds
   * @param limit - the requests allowed in a window
   * @param blockDuration - how long a client that went over the limit is blocked, in milliseconds; 0 for no block
   * @param throttlerName - the throttler that counts (part of the Redis key)
   * @returns the hits in the window, whether the client is blocked, and the times in seconds
   * @throws Error when Redis cannot be reached or the script returns something unexpected
   */
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<StorageRecord> {
    // e.g. `coffra:rate-limit:{auth:203.0.113.1:default}`. The braces put both keys in one hash slot, so the script
    // also runs on a Redis Cluster.
    const name = `${REDIS_KEY_PREFIX}{${key}:${throttlerName}}`
    const reply = await this.redis.rateLimitIncrement(
      `${name}:hits`,
      `${name}:block`,
      ttl,
      limit,
      blockDuration,
      // Unique id of the hit: two hits in the same millisecond must stay two members of the sorted set.
      randomUUID(),
    )

    if (!isScriptReply(reply)) {
      throw new TypeError('Unexpected reply of the rate limit script')
    }
    const [totalHits, timeToExpire, isBlocked, timeToBlockExpire] = reply

    return {
      totalHits,
      timeToExpire: toSeconds(timeToExpire),
      isBlocked: isBlocked === 1,
      timeToBlockExpire: toSeconds(timeToBlockExpire),
    }
  }
}
