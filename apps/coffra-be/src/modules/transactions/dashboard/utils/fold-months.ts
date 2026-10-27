import { Money } from '../../common/money'
import type { DayTotal } from '../../totals/totals.types'
import type { MonthSummary } from '../dashboard.types'

/**
 * Folds the totals per currency and day into one series of months per currency.
 *
 * Every currency in `currencies` gets every month in `months`, in that order: a month without a transaction is there
 * with zeros, so the series always has the length of the window. For example, for the months `2026-08`, `2026-09` and
 * `2026-10`:
 *
 * ```
 * days (what the totals service returned)      series (what this function returns)
 * CZK · 2026-08-31 · income 100 · expense  0   CZK · 2026-08 · income 100 · expense   0 · net  100
 * CZK · 2026-10-01 · income   0 · expense 30   CZK · 2026-09 · income   0 · expense   0 · net    0
 * CZK · 2026-10-15 · income   0 · expense 20   CZK · 2026-10 · income   0 · expense  50 · net  -50
 * ```
 *
 * The amounts are added and subtracted as `Money`, so a total of many large amounts stays exact.
 *
 * @param days - the totals per currency and day, in any order
 * @param months - the months of the window as `YYYY-MM`, the oldest first
 * @param currencies - the currencies to make a series for; the days of any other currency are left out
 * @returns the series by currency
 * @throws Error when a day falls in none of the months: the totals service only returns days of the window it was
 * asked for, so this is a broken invariant and not a client error
 */
export const foldMonths = (
  days: readonly DayTotal[],
  months: readonly string[],
  currencies: readonly string[],
): Map<string, MonthSummary[]> => {
  // The months of every currency by their name, each with zero on every side, filled while we walk through the days.
  // The sum starts from a `Money` value: from a plain `Prisma.Decimal` it would round to 20 digits.
  const sums = new Map(
    currencies.map((currency) => [
      currency,
      new Map(months.map((month) => [month, { income: new Money(0), expense: new Money(0) }])),
    ]),
  )

  for (const { currency, date, income, expense } of days) {
    // 1. A currency nobody asked for is left out. The totals by category and by day are two reads, so a transaction
    // written between them can bring a currency to one and not to the other.
    const series = sums.get(currency)

    if (series === undefined) {
      continue
    }

    // 2. Which month is this day in? The first seven characters of `YYYY-MM-DD`.
    const sum = series.get(date.slice(0, 7))

    if (sum === undefined) {
      throw new Error('A day of the totals falls outside the months of the window')
    }

    // 3. Add the day to the month.
    sum.income = sum.income.plus(income)
    sum.expense = sum.expense.plus(expense)
  }

  // 4. Every month is in: write the series, each month with its net. A `Map` keeps the order its entries were added in,
  // which is the order of the window.
  return new Map(
    [...sums].map(([currency, series]) => [
      currency,
      [...series].map(([month, { income, expense }]) => ({ month, income, expense, net: income.minus(expense) })),
    ]),
  )
}
