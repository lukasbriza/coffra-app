import { SkipThrottle } from '@nestjs/throttler'

/**
 * Takes a route (or a whole controller) out of the rate limit: its requests are not counted and never answered with
 * `429`.
 *
 * Meant for what an orchestrator calls on a timer from one address (the health probe), where a `429` would make a
 * healthy application look dead.
 *
 * @returns the decorator that exempts the route
 */
export const SkipRateLimit = (): ReturnType<typeof SkipThrottle> => SkipThrottle()
