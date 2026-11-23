/**
 * Runs once when a Next.js server starts (`next dev`, `next start`). Validates the server environment, so a missing or
 * invalid `API_BASE_URL` is reported at start instead of on the first call of the API. Next logs the error and every
 * request then answers 500; `next build` does not run this hook.
 *
 * @throws {Error} When the server environment is invalid.
 */
export const register = async (): Promise<void> => {
  // Set by Next.js itself per runtime, never by the environment, so turbo has nothing to declare.
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  if (process.env.NEXT_RUNTIME !== 'nodejs') {
    return
  }

  const { getServerEnv } = await import('./lib/env')
  getServerEnv()
}
