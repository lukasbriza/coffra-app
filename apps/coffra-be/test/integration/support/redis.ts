import { Redis } from 'ioredis'

import { REDIS_KEY_PREFIX } from '../../../src/modules/rate-limit/constants'

// Shared by the rate limit specs of the integration suite: which Redis they may use, and a connection to clean it.

/**
 * The connection string of the Redis of the suite, from `TEST_REDIS_URL` (set by the vitest config).
 *
 * @returns the connection string
 * @throws Error when it is missing
 */
export const testRedisUrl = (): string => {
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  const url = process.env.TEST_REDIS_URL

  if (url === undefined || url === '') {
    throw new Error('The rate limit specs need a Redis connection string in TEST_REDIS_URL.')
  }

  return url
}

/**
 * Opens a connection of the specs themselves (to clean up and to look inside), apart from the one the app opens.
 *
 * @returns the connection; the caller quits it
 */
export const openRedis = (): Redis => new Redis(testRedisUrl())

/**
 * Deletes every key the rate limit wrote, and only those (the prefix), so the next spec starts from nothing and a Redis
 * that is used for something else keeps its data.
 *
 * @param redis - a connection of the specs
 */
export const clearRateLimitKeys = async (redis: Redis): Promise<void> => {
  const keys = await redis.keys(`${REDIS_KEY_PREFIX}*`)

  if (keys.length > 0) {
    await redis.del(...keys)
  }
}
