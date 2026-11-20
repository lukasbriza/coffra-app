import { SetMetadata } from '@nestjs/common'

import { STRICT_RATE_LIMIT } from '../constants'

/**
 * Puts a route (or a whole controller) in the strict bucket of the rate limit: the lower limit
 * (`RATE_LIMIT_AUTH_MAX`), counted for all strict routes of one client address together and apart from the requests
 * to every other route.
 *
 * Meant for the routes an attacker would hammer. On a controller class a route added later is strict without anyone
 * remembering it.
 *
 * @returns the decorator that marks the route as strict
 */
export const StrictRateLimit = (): ReturnType<typeof SetMetadata> => SetMetadata(STRICT_RATE_LIMIT, true)
