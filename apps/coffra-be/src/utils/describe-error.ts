/**
 * Short, log-safe description of a caught value: the error class and its `code` when it has a string one.
 * Never includes the message, which can echo request or response data (tokens, codes, hosts).
 */
export const describeError = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return 'unknown error'
  }
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? `${error.name} ${code}` : error.name
}
