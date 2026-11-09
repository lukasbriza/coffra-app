import type { Snapshot } from './snapshot'

/**
 * The ids of the accounts of a user in a snapshot.
 *
 * @param snapshot - every row of every table
 * @param userId - the user
 * @returns the ids of the accounts of that user
 */
export const accountIdsOf = (snapshot: Snapshot, userId: string): ReadonlySet<string> =>
  new Set(snapshot.accounts.filter((row) => row.userId === userId).map(({ id }) => id))

/**
 * The rows of one user in every table: the user, their accounts and categories, and the transactions on their accounts.
 *
 * After the accounts are deleted, a transaction left on one of them can be found only through the ids of the accounts
 * from before, so a spec of the deletion passes them in.
 *
 * @param snapshot - every row of every table
 * @param userId - the user
 * @param accountIds - the accounts whose transactions belong to the user; by default those the snapshot gives the user
 * @returns the rows of that user, in the order of the snapshot
 */
export const ownedRows = (
  snapshot: Snapshot,
  userId: string,
  accountIds: ReadonlySet<string> = accountIdsOf(snapshot, userId),
): Snapshot => ({
  users: snapshot.users.filter(({ id }) => id === userId),
  accounts: snapshot.accounts.filter((row) => row.userId === userId || accountIds.has(row.id)),
  categories: snapshot.categories.filter((row) => row.userId === userId),
  transactions: snapshot.transactions.filter(({ accountId }) => accountIds.has(accountId)),
})
