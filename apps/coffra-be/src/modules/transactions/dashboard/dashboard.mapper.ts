import { formatMoney } from '../common/format-money'
import type { TotalsRange } from '../totals/totals.types'

import type {
  CategorySummary,
  CategoryView,
  CurrencySummary,
  CurrencyView,
  DashboardView,
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
 * Writes the amounts of a currency, and of the categories in it, as decimal strings.
 *
 * @param summary - the currency with its totals and categories
 * @returns the currency as the API shows it
 */
const toCurrencyView = ({ currency, income, expense, net, categories }: CurrencySummary): CurrencyView => ({
  currency,
  income: formatMoney(income),
  expense: formatMoney(expense),
  net: formatMoney(net),
  categories: categories.map(toCategoryView),
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
