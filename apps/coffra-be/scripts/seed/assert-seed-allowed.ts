/**
 * Decides whether the seed may run and gives the database it runs against. Pure: the environment is passed in.
 *
 * Production is refused before anything else is read. A missing `NODE_ENV` counts as development, like in the
 * configuration of the app. The messages name the variable and never its value: a connection string carries a password.
 *
 * @param env - the environment of the process (`process.env`)
 * @returns the connection string of the database
 * @throws Error when `NODE_ENV` is `production`, or `DATABASE_URL` is missing or not a Postgres connection string
 */
export const assertSeedAllowed = (env: Readonly<Record<string, string | undefined>>): string => {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed: NODE_ENV is production.')
  }

  const url = env.DATABASE_URL

  if (url === undefined || url === '') {
    throw new Error('DATABASE_URL: is not set.')
  }

  if (!/^postgres(ql)?:\/\/.+/u.test(url)) {
    throw new Error('DATABASE_URL: must be a postgres:// or postgresql:// connection string.')
  }

  return url
}
