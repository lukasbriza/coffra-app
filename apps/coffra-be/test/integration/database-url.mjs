/** The throwaway database of the suite, on the dev Postgres of `docker/docker-compose.yaml` (public dev credentials). */
export const DEFAULT_DATABASE_URL = 'postgresql://coffra:coffra@127.0.0.1:5439/coffra_test'

/**
 * The connection string of the integration suite: `TEST_DATABASE_URL` (CI, another server), or the dev Postgres.
 * Shared by the vitest config and the check that runs before it (`require-postgres.mjs`).
 *
 * @returns the connection string
 */
// eslint-disable-next-line turbo/no-undeclared-env-vars
export const databaseUrl = () => process.env.TEST_DATABASE_URL ?? DEFAULT_DATABASE_URL
