import 'server-only'

import { parseApiBaseUrl } from './parse-api-base-url'
import type { ServerEnv } from './types'

let serverEnv: ServerEnv | undefined

/**
 * Reads and validates the server-only environment once; later calls return the same object.
 *
 * @returns The validated server configuration.
 * @throws {Error} When a variable is missing or invalid (see {@link parseApiBaseUrl}).
 */
export const getServerEnv = (): ServerEnv => {
  if (serverEnv !== undefined) {
    return serverEnv
  }

  serverEnv = {
    apiBaseUrl: parseApiBaseUrl(process.env.API_BASE_URL),
  }

  return serverEnv
}
