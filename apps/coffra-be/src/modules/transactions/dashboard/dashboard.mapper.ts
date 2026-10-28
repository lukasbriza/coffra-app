import { formatMoney } from '../common/format-money'
import type { TotalsRange } from '../totals/totals.types'

import type {
  CategorySummary,
  CategoryView,
  CurrencySummary,
  CurrencyView,
  DashboardView,
  MonthSummary,
  MonthView,
  Period,
} from './dashboard.types'

/**
 * Writes the amounts of a category as decimal strings.
 *
 * @param category - the category with its amounts
 * @returns the category as the API shows it
 */
const toCategoryView = ({ categoryId, name, income, expense, net }: CategorySummary): CategoryView => ({
  categoryId,
  name,
  income: formatMoney(income),
  expense: formatMoney(expense),
  net: formatMoney(net),
})

/**
 * Writes the amounts of a month as decimal strings.
 *
 * @param month - the month with its amounts
 * @returns the month as the API shows it
 */
const toMonthView = ({ month, income, expense, net }: MonthSummary): MonthView => ({
  month,
  income: formatMoney(income),
  expense: formatMoney(expense),
  net: formatMoney(net),
})

/**
 * Writes the amounts of a currency, and of the categories and the months in it, as decimal strings.
 *
 * @param summary - the currency with its totals, categories and months
 * @returns the currency as the API shows it
 */
const toCurrencyView = ({ currency, income, expense, net, categories, trend }: CurrencySummary): CurrencyView => ({
  currency,
  income: formatMoney(income),
  expense: formatMoney(expense),
  net: formatMoney(net),
  categories: categories.map(toCategoryView),
  trend: trend.map(toMonthView),
})

/**
 * The only way the dashboard leaves the service.
 *
 * It computes nothing: every amount is already added up, and here it only becomes a decimal string with four decimal
 * places. The calculation stays in `Money` until this last step, so nothing is rounded on the way.
 *
 * @param period - the period that was used
 * @param window - the first and the last day the totals cover
 * @param summaries - the totals per currency
 * @returns the dashboard as the API shows it
 */
export const toDashboardView = (
  period: Period,
  { from, to }: TotalsRange,
  summaries: readonly CurrencySummary[],
): DashboardView => ({
  period,
  from,
  to,
  currencies: summaries.map(toCurrencyView),
})
