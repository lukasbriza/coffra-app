import { seedDemo } from '../../../scripts/seed/seed-demo'
import type { SeedSummary } from '../../../scripts/seed/types'
import { stopClock } from '../support/clock'
import { utcDayOf } from '../support/dashboard-sql'
import type { useIntegrationApp } from '../support/use-integration-app'
import type { World } from '../support/world'

// Shared by the specs of the seed: the demo user next to the two users of the world, seeded on a stopped clock.

/** The helpers `useIntegrationApp()` returns. */
export type IntegrationApp = ReturnType<typeof useIntegrationApp>

/** The two users of the world, the demo user with a token, and what the seed reported. */
export type Seeded = World & { demo: { userId: string; token: string }; summary: SeedSummary }

/**
 * Stops the clock at `instant`, seeds the demo user for that day and signs a token for it. The app computes the window
 * of the dashboard and the balance of "today" from the clock, so the clock and the day of the seed must agree.
 *
 * @param app - the helpers of the current spec
 * @param instant - where the clock stands, as an ISO string
 * @returns both users of the world with tokens of the stopped clock, the demo user and the summary of the seed
 */
export const seedAt = async (app: IntegrationApp, instant: string): Promise<Seeded> => {
  const users = await stopClock(instant, app.world(), app.issueToken)
  const summary = await seedDemo(app.prisma(), utcDayOf(instant))

  return { ...users, summary, demo: { userId: summary.userId, token: await app.issueToken(summary.userId) } }
}

/**
 * An amount as the API spells it, from a whole number written in the spec.
 *
 * @param value - the amount
 * @returns four decimal places
 */
export const money = (value: number): string => value.toFixed(4)
