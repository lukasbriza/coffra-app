import { DEMO_USER } from '../constants'
import type { SeedSummary } from '../types'

/**
 * One sentence about a seed run, for the terminal.
 *
 * @param summary - what the run did
 * @returns what was written and what it replaced
 */
export const describeSummary = ({
  userId,
  from,
  today,
  accounts,
  categories,
  transactions,
  transfers,
  removed,
}: SeedSummary): string =>
  `Seeded ${DEMO_USER.email} (user ${userId}) for ${today}: ${accounts} accounts, ${categories} categories and ` +
  `${transactions} transactions (${transfers} of them transfers) from ${from}. Replaced ${removed.accounts} accounts, ` +
  `${removed.categories} categories and ${removed.transactions} transactions.`
