import { Money } from '../../common/money'
import type { CategoryTotal } from '../../totals/totals.types'
import type { CurrencySummary } from '../dashboard.types'

import { compareCategories } from './compare-categories'

/**
 * Turns the totals per currency and category into what the dashboard shows: a total of every currency and the
 * categories it is made of, each with its net.
 *
 * For example, with two currencies:
 *
 * ```
 * rows (what the totals service returned)       summaries (what this function returns)
 * CZK · Food   · income    0 · expense 150       CZK · income 5000 · expense 150 · net 4850
 * CZK · Salary · income 5000 · expense   0           Salary · income 5000 · expense   0 · net  5000
 * EUR · Food   · income    0 · expense  10            Food   · income    0 · expense 150 · net  -150
 *                                                EUR · income 0 · expense 10 · net -10
 *                                                    Food   · income 0 · expense 10 · net -10
 * ```
 *
 * The amounts are added and subtracted as `Money`, so a total of many large amounts stays exact.
 *
 * @param rows - the totals per currency and category, ordered by currency
 * @returns one summary per currency in the order the rows came in; empty when there are no rows
 */
export const summarizeTotals = (rows: readonly CategoryTotal[]): CurrencySummary[] => {
  // The summaries by currency, in the order the currencies first appear; filled while we walk through the rows.
  const summaries = new Map<string, CurrencySummary>()

  for (const { currency, category, income, expense } of rows) {
    // 1. Take the summary of this currency, or start one with zero on every side. The sum starts from a `Money` value:
    // from a plain `Prisma.Decimal` it would round to 20 digits.
    const summary = summaries.get(currency) ?? {
      currency,
      income: new Money(0),
      expense: new Money(0),
      net: new Money(0),
      categories: [],
    }

    // 2. Add the row to the totals of the currency.
    summary.income = summary.income.plus(income)
    summary.expense = summary.expense.plus(expense)

    // 3. Keep the row as a category, with what is left of its income after its expense.
    summary.categories.push({
      categoryId: category?.id ?? null,
      name: category?.name ?? null,
      income,
      expense,
      net: income.minus(expense),
    })

    summaries.set(currency, summary)
  }

  // 4. Now that every row is in, finish each currency: its net and its categories in the order of the dashboard.
  return [...summaries.values()].map((summary) => ({
    ...summary,
    net: summary.income.minus(summary.expense),
    categories: summary.categories.toSorted(compareCategories),
  }))
}
