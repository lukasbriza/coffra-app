import { Money } from '../../common/money'
import type { CategoryTotal, GroupedTotal } from '../totals.types'

import { addToRow } from './add-to-row'
import { categoryOf } from './category-of'
import { compareRows } from './compare-rows'
import { currencyOf } from './currency-of'
import { rowKey } from './row-key'

/**
 * Folds the sums the database grouped by account, category and type into one row per currency and category.
 *
 * The database cannot group by the currency of an account, so it groups by the account and this function adds the
 * groups of accounts in the same currency together. For example, with two accounts in CZK and one in EUR:
 *
 * ```
 * groups (what the database returned)             rows (what this function returns)
 * CZK account 1 · Food   · expense  100.00        CZK · Food   · income    0.00 · expense 150.00
 * CZK account 2 · Food   · expense   50.00        CZK · Salary · income 5000.00 · expense   0.00
 * CZK account 2 · Salary · income  5000.00        EUR · Food   · income    0.00 · expense  10.00
 * EUR account 3 · Food   · expense   10.00
 * ```
 *
 * The amounts are `Money` values (see `Money`), so a sum of many large amounts stays exact and the caller can add and
 * subtract the amounts of the rows without losing digits.
 *
 * @param groups - sums by account, category and type, in any order
 * @param currencies - currency of every account that appears in `groups`, by account id
 * @param categories - name of every category that appears in `groups`, by category id
 * @returns the rows ordered by currency, then by category name (code units), the rows without a category last
 * @throws Error when a group has an account or a category that the maps do not know, or is a transfer: the query
 * leaves transfers out and a transaction cannot outlive its account or its category, so these are broken invariants
 * and not client errors
 */
export const foldGroups = (
  groups: readonly GroupedTotal[],
  currencies: ReadonlyMap<string, string>,
  categories: ReadonlyMap<string, string>,
): CategoryTotal[] => {
  // The rows of the result by their key (currency + category), filled while we walk through the groups.
  const rows = new Map<string, CategoryTotal>()

  for (const group of groups) {
    // 1. In which currency is this group? It is the currency of its account.
    const currency = currencyOf(group.accountId, currencies)

    // 2. Which category does it have? `null` when the transactions have none.
    const category = categoryOf(group.categoryId, categories)

    // 3. Take the row of this currency and category, or start a new one with zero on both sides.
    const key = rowKey(currency, group.categoryId)
    const row = rows.get(key) ?? { currency, category, income: new Money(0), expense: new Money(0) }

    // 4. Add the sum of the group to the income or to the expense of the row.
    addToRow(row, group)
    rows.set(key, row)
  }

  // 5. The rows are in the order the groups came; put them in the order the callers can rely on.
  return [...rows.values()].toSorted(compareRows)
}
