import type { CategorySummary } from '../dashboard.types'

/**
 * Tells which of two categories of one currency comes first on the dashboard: the one with more money moved.
 *
 * The size of a category is its income plus its expense. The transactions without a category always go last, however
 * large they are. Categories of the same size compare equal, so a stable sort keeps the order they came in.
 *
 * @param a - the first category
 * @param b - the second category
 * @returns the sign of the comparison, as `Array.prototype.toSorted` wants it
 */
export const compareCategories = (a: CategorySummary, b: CategorySummary): number => {
  // The transactions without a category go after the categories that exist.
  if (a.categoryId === null) {
    return b.categoryId === null ? 0 : 1
  }

  if (b.categoryId === null) {
    return -1
  }

  // The larger one first.
  return b.income.plus(b.expense).comparedTo(a.income.plus(a.expense))
}
