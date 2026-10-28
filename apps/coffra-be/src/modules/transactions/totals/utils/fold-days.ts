import { Money } from '../../common/money'
import type { DailyGroupedTotal, DayTotal } from '../totals.types'

import { addToRow } from './add-to-row'
import { compareDays } from './compare-days'
import { currencyOf } from './currency-of'

/**
 * Folds the sums the database grouped by account, type and day into one row per currency and day.
 *
 * The database cannot group by the currency of an account, so it groups by the account and this function adds the
 * groups of accounts in the same currency together. For example, with two accounts in CZK and one in EUR:
 *
 * ```
 * groups (what the database returned)             rows (what this function returns)
 * CZK account 1 · 2026-10-01 · expense  100.00    CZK · 2026-10-01 · income    0.00 · expense 150.00
 * CZK account 2 · 2026-10-01 · expense   50.00    CZK · 2026-10-05 · income 5000.00 · expense   0.00
 * CZK account 2 · 2026-10-05 · income  5000.00    EUR · 2026-10-01 · income    0.00 · expense  10.00
 * EUR account 3 · 2026-10-01 · expense   10.00
 * ```
 *
 * The amounts are `Money` values (see `Money`), so a sum of many large amounts stays exact and the caller can add and
 * subtract the amounts of the rows without losing digits.
 *
 * @param groups - sums by account, type and day, in any order
 * @param currencies - currency of every account that appears in `groups`, by account id
 * @returns the rows ordered by currency, then by day
 * @throws Error when a group has an account that the map does not know, or is a transfer: the query leaves transfers
 * out and a transaction cannot outlive its account, so these are broken invariants and not client errors
 */
export const foldDays = (groups: readonly DailyGroupedTotal[], currencies: ReadonlyMap<string, string>): DayTotal[] => {
  // The rows of the result by their key (currency + day), filled while we walk through the groups.
  const rows = new Map<string, DayTotal>()

  for (const group of groups) {
    // 1. In which currency is this group? It is the currency of its account.
    const currency = currencyOf(group.accountId, currencies)

    // 2. Take the row of this currency and day, or start a new one with zero on both sides. The sum starts from a
    // `Money` value: from a plain `Prisma.Decimal` it would round to 20 digits.
    const key = `${currency}|${group.date}`
    const row = rows.get(key) ?? { currency, date: group.date, income: new Money(0), expense: new Money(0) }

    // 3. Add the sum of the group to the income or to the expense of the row.
    addToRow(row, group)
    rows.set(key, row)
  }

  // 4. The rows are in the order the groups came; put them in the order the callers can rely on.
  return [...rows.values()].toSorted(compareDays)
}
