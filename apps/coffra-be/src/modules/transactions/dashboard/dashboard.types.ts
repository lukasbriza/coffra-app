import type { Prisma } from '../../prisma'

import type { PERIODS } from './constants'

/** A period of the dashboard: the last 3 months, 6 months or a year, counted in calendar months. */
export type Period = (typeof PERIODS)[number]

/**
 * The query of `GET /api/dashboard`.
 *
 * @property period - how many calendar months back the dashboard goes, the current month included; `3m` when left out
 */
export type DashboardQuery = {
  period?: Period
}

/**
 * Income and expense of one category in one currency, over the window of the dashboard.
 *
 * Every amount is a `Money` value (`Prisma.Decimal` with 40 significant digits), so adding and subtracting them stays
 * exact.
 *
 * @property categoryId - id of the category; `null` for the transactions that have none
 * @property name - name of the category; `null` together with `categoryId`
 * @property income - sum of the income
 * @property expense - sum of the expense
 * @property net - `income` minus `expense`; negative when more was spent than earned
 */
export type CategorySummary = {
  categoryId: string | null
  name: string | null
  income: Prisma.Decimal
  expense: Prisma.Decimal
  net: Prisma.Decimal
}

/**
 * Income and expense of one currency in one calendar month of the window of the dashboard.
 *
 * Every amount is a `Money` value (`Prisma.Decimal` with 40 significant digits), so adding and subtracting them stays
 * exact.
 *
 * @property month - the calendar month in UTC, `YYYY-MM`
 * @property income - sum of the income of the month; `0` when there is none
 * @property expense - sum of the expense of the month; `0` when there is none
 * @property net - `income` minus `expense`; negative when more was spent than earned
 */
export type MonthSummary = {
  month: string
  income: Prisma.Decimal
  expense: Prisma.Decimal
  net: Prisma.Decimal
}

/**
 * The totals of one currency, the categories they are made of and the months they are spread over.
 *
 * @property currency - three capital letters; amounts of two currencies are never added
 * @property income - sum of the income of every category
 * @property expense - sum of the expense of every category
 * @property net - `income` minus `expense`
 * @property categories - the categories, the one with the largest `income + expense` first, the transactions without a
 * category last
 * @property trend - every month of the window, the oldest first, with zeros in a month without a transaction
 */
export type CurrencySummary = {
  currency: string
  income: Prisma.Decimal
  expense: Prisma.Decimal
  net: Prisma.Decimal
  categories: CategorySummary[]
  trend: MonthSummary[]
}

/**
 * What the API returns for a category: the amounts as decimal strings with four decimal places.
 *
 * @property categoryId - id of the category (UUID); `null` for the transactions that have none
 * @property name - name of the category; `null` together with `categoryId`
 * @property income - sum of the income, e.g. `"1250.5000"`
 * @property expense - sum of the expense
 * @property net - `income` minus `expense`, e.g. `"-300.2500"`
 */
export type CategoryView = {
  categoryId: string | null
  name: string | null
  income: string
  expense: string
  net: string
}

/**
 * What the API returns for a month.
 *
 * @property month - the calendar month in UTC, `YYYY-MM`
 * @property income - sum of the income of the month, a decimal string with four decimal places, e.g. `"26000.0000"`
 * @property expense - sum of the expense of the month
 * @property net - `income` minus `expense`, e.g. `"-300.2500"`
 */
export type MonthView = {
  month: string
  income: string
  expense: string
  net: string
}

/**
 * What the API returns for a currency.
 *
 * @property currency - three capital letters
 * @property income - sum of the income of the currency, a decimal string with four decimal places
 * @property expense - sum of the expense of the currency
 * @property net - `income` minus `expense`
 * @property categories - the categories the totals are made of, the largest first, the transactions without a category
 * last
 * @property trend - the months of the window, the oldest first, as many as the period covers; a month without a
 * transaction has zeros
 */
export type CurrencyView = {
  currency: string
  income: string
  expense: string
  net: string
  categories: CategoryView[]
  trend: MonthView[]
}

/**
 * What the API returns for the dashboard.
 *
 * @property period - the period that was used, `3m` when the request named none
 * @property from - first day of the window, `YYYY-MM-DD`: the first day of the oldest month
 * @property to - last day of the window, `YYYY-MM-DD`: the last day of the current month
 * @property currencies - one entry per currency that has a transaction in the window, in alphabetical order; empty when
 * nothing falls in it
 */
export type DashboardView = {
  period: Period
  from: string
  to: string
  currencies: CurrencyView[]
}
