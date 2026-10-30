import { type TestDatabase, testDatabase } from '../../integration/support/test-database'

// What every spec of the image suite shares: which image, which database, and a complete production configuration.

/** The image under test: `IMAGE` (CI passes its own tag), by default the one `pnpm image:build` makes. */
// eslint-disable-next-line turbo/no-undeclared-env-vars
export const IMAGE = process.env.IMAGE ?? 'coffra-be:local'

/** Label of every container of the suite, so that a run that crashed can be cleaned up by the next one. */
export const CONTAINER_LABEL = 'coffra-image-test'

/** Name under which a container reaches the Postgres that listens on the host. */
export const HOST_ALIAS = 'host.docker.internal'

/** The secrets of the test configuration; a log must never contain any of these values. */
export const SECRETS = {
  OIDC_CLIENT_SECRET: 'image-test-client-secret-value',
  JWT_ACCESS_SECRET: 'image-test-access-secret-0123456789abcdef',
  JWT_REFRESH_SECRET: 'image-test-refresh-secret-0123456789abcdef',
  AUTH_CHECKS_SECRET: 'image-test-checks-secret-0123456789abcdef',
}

/**
 * The database of the suite, read from the `DATABASE_URL` the vitest config sets.
 *
 * @returns the database, checked to be one the suite may drop
 * @throws Error when the name is outside `coffra_test*`
 */
// eslint-disable-next-line turbo/no-undeclared-env-vars
export const imageDatabase = (): TestDatabase => testDatabase(process.env.DATABASE_URL)

/**
 * The connection string a container uses: the same server, reached through the host when it listens on the loopback of
 * the machine that runs Docker.
 *
 * @param database - the database of the suite
 * @returns the connection string for inside a container
 */
export const containerDatabaseUrl = (database: TestDatabase): string => {
  const url = new URL(database.url)

  if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    url.hostname = HOST_ALIAS
  }

  return url.toString()
}

/**
 * A complete, valid production configuration. The OIDC provider is never contacted (discovery is lazy), so any
 * `https` address will do.
 *
 * @param databaseUrl - the connection string the container uses
 * @returns the environment variables of the container
 */
export const productionEnvironment = (databaseUrl: string): Record<string, string> => ({
  DATABASE_URL: databaseUrl,
  OIDC_ISSUER_URL: 'https://idp.example.test/realms/coffra',
  OIDC_CLIENT_ID: 'coffra-be',
  OIDC_REDIRECT_URI: 'https://app.example.test/api/auth/callback',
  ...SECRETS,
})
