import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../../../src/modules/prisma/generated/client'

// Shared by the global setup and the app of the integration specs: which database they may use, and a client on the
// maintenance database to create and drop it.

/** Every database the suite touches starts with this: the specs truncate all tables, so nothing else may match. */
export const TEST_DATABASE_PREFIX = 'coffra_test'

/** The database of the suite, read from its connection string. */
export type TestDatabase = {
  /** Connection string of the test database itself. */
  url: string
  /** Its name, checked to start with `TEST_DATABASE_PREFIX`. */
  name: string
  /** The same server, database `postgres`: where the test database is created and dropped. */
  maintenanceUrl: string
  /** `host:port`, for error messages. */
  host: string
}

/**
 * Parses the connection string of the test database and refuses anything that is not one.
 *
 * @param url - the `DATABASE_URL` of the suite
 * @returns the parts the setup needs
 * @throws Error when the url is missing, malformed or names a database outside `TEST_DATABASE_PREFIX`
 */
export const testDatabase = (url: string | undefined): TestDatabase => {
  if (url === undefined || !URL.canParse(url)) {
    throw new Error(`The integration specs need a Postgres connection string in TEST_DATABASE_URL, got "${url}".`)
  }

  const parsed = new URL(url)
  const name = decodeURIComponent(parsed.pathname.slice(1))

  if (!/^coffra_test\w*$/u.test(name)) {
    throw new Error(
      `Refusing to run the integration specs against the database "${name}": they drop and truncate it, so its name ` +
        `must start with "${TEST_DATABASE_PREFIX}".`,
    )
  }

  const maintenance = new URL(url)
  maintenance.pathname = '/postgres'

  return { url, name, maintenanceUrl: maintenance.toString(), host: parsed.host }
}

/**
 * A Prisma client on the given connection string, through the same driver adapter as the app.
 *
 * @param connectionString - which database to connect to
 * @returns a client the caller disconnects
 */
export const connect = (connectionString: string): PrismaClient =>
  new PrismaClient({ adapter: new PrismaPg({ connectionString }) })
