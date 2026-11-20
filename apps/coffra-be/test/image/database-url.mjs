import { databaseUrl } from '../integration/database-url.mjs'

/** The throwaway database of the image suite: its own, next to the one of the integration suite. */
export const IMAGE_DATABASE = 'coffra_test_image'

/**
 * The connection string of the image suite: the server of the integration suite (`TEST_DATABASE_URL`, by default the
 * dev Postgres), the database `coffra_test_image`. Shared by the vitest config of the suite and its global setup.
 *
 * @returns {string} the connection string
 */
export const imageDatabaseUrl = () => {
  const url = new URL(databaseUrl())

  url.pathname = `/${IMAGE_DATABASE}`

  return url.toString()
}
