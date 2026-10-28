import { vi } from 'vitest'

import type { World } from './world'

/**
 * Stops `Date` at `instant` and gives both users of the world a token signed by that clock. The tokens of the seed were
 * signed with the real clock, and a clock moved far from it would turn them away.
 *
 * Only `Date` is faked: timers keep running, so the app, the driver and supertest work as usual. The hooks of
 * `useIntegrationApp` put the clock back after the test.
 *
 * @param instant - the moment the clock stands at, as an ISO string
 * @param world - the two users of the current test
 * @param issueToken - gives an access token for a user id, signed with the clock as it is now
 * @returns the same users with the new tokens
 */
export const stopClock = async (
  instant: string,
  world: World,
  issueToken: (userId: string) => Promise<string>,
): Promise<World> => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(instant) })

  return {
    a: { ...world.a, token: await issueToken(world.a.userId) },
    b: { ...world.b, token: await issueToken(world.b.userId) },
  }
}
