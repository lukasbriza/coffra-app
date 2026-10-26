import type { CategoryTotal } from '../totals.types'

import { compareText } from './compare-text'

/**
 * Tells which of two rows comes first in the result: the currency decides, then the name of the category, and a row
 * without a category always goes last in its currency.
 *
 * Example of the final order: `CZK Food`, `CZK Salary`, `CZK (no category)`, `EUR Food`.
 *
 * @param a - the first row
 * @param b - the second row
 * @returns the sign of the comparison, as `Array.prototype.toSorted` wants it
 */
export const compareRows = (a: CategoryTotal, b: CategoryTotal): number => {
  // Different currencies: the currency decides.
  if (a.currency !== b.currency) {
    return compareText(a.currency, b.currency)
  }

  // The same currency: a row without a category goes after the rows that have one.
  if (a.category === null) {
    return b.category === null ? 0 : 1
  }

  if (b.category === null) {
    return -1
  }

  // Both have a category: by name. Names are unique per owner; the id only keeps the order total should that change.
  return compareText(a.category.name, b.category.name) || compareText(a.category.id, b.category.id)
}
