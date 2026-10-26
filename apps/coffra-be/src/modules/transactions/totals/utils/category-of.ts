import type { TotalsCategory } from '../totals.types'

/**
 * Finds the category of a group of transactions.
 *
 * @param categoryId - id of the category of the group; `null` for transactions that have none
 * @param categories - name of every category that was read, by category id
 * @returns the category with its name, or `null` when the transactions have no category
 * @throws Error when the category was not read. That happens when a transaction points at a category of another owner
 * (it must never), and failing here means the name of that category is never shown
 */
export const categoryOf = (
  categoryId: string | null,
  categories: ReadonlyMap<string, string>,
): TotalsCategory | null => {
  // Transactions without a category stay without one.
  if (categoryId === null) {
    return null
  }

  const name = categories.get(categoryId)

  if (name === undefined) {
    throw new Error('A group of transactions belongs to a category that was not read')
  }

  return { id: categoryId, name }
}
