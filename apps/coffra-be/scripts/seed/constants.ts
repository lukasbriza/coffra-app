/**
 * The user the seed writes the demo data for: the one of the dev realm (`docker/keycloak/coffra-realm.json`). Its
 * `sub` is fixed there, so the first login finds the seeded data instead of an empty account.
 */
export const DEMO_USER = {
  subject: 'dde84b4e-03ed-4990-a23b-e1be2e5eaf1a',
  email: 'dev@coffra.local',
} as const

/** How many calendar months of history the seed writes, the current one included: the widest period of the dashboard. */
export const SEED_MONTHS = 12

/** The planned payment is dated this many days after today. */
export const PLANNED_DAYS_AHEAD = 3
