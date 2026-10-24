/**
 * Describes a caught value in a short, log-safe way: the error class and its `code` when it has a string one.
 *
 * Never includes the message, which can echo request or response data (tokens, codes, hosts).
 *
 * @param error - whatever was thrown
 * @returns e.g. `TypeError`, `Error ECONNREFUSED`, or `unknown error` for a value that is not an `Error`
 */
export const describeError = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return 'unknown error'
  }
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? `${error.name} ${code}` : error.name
}
