/** The Redis of the suite: the one of `docker/docker-compose.yaml` (public dev setup, no password). */
export const DEFAULT_REDIS_URL = 'redis://127.0.0.1:6389'

/**
 * The connection string of the Redis the rate limit specs use: `TEST_REDIS_URL` (CI, another server), or the dev Redis.
 * Shared by the vitest config and the check that runs before it (`require-services.mjs`).
 *
 * @returns the connection string
 */
// eslint-disable-next-line turbo/no-undeclared-env-vars
export const redisUrl = () => process.env.TEST_REDIS_URL ?? DEFAULT_REDIS_URL
