import { expect } from 'vitest'

import type { CurrencyBody, DashboardBody } from './dashboard-sql'
import type { Client } from './use-integration-app'

// What every spec of the dashboard asks the same way: fetch it, and check that the figures of one answer add up.

const AMOUNT = /^-?\d+\.\d{4}$/

/**
 * An amount of the API as a whole number of ten-thousandths, so sums are exact and do not share the arithmetic of the
 * code under test.
 *
 * @param amount - a decimal string with four decimal places (`-12.5000`)
 * @returns the amount times 10 000
 */
export const units = (amount: string): bigint => {
  expect(amount, 'an amount has four decimal places').toMatch(AMOUNT)

  return BigInt(amount.replace('.', ''))
}

/**
 * The sum of amounts, in ten-thousandths.
 *
 * @param amounts - decimal strings of the API
 * @returns their sum
 */
const sum = (amounts: string[]): bigint => {
  let total = 0n

  for (const amount of amounts) {
    total += units(amount)
  }

  return total
}

/**
 * Asserts that one currency adds up: its categories and its months each add up to its income and its expense, and every
 * net is income minus expense. Checked on the answer alone, so it holds whatever the data is.
 *
 * @param currency - one currency of an answer
 */
const expectCurrencyAddsUp = ({ currency, income, expense, net, categories, trend }: CurrencyBody): void => {
  const label = (what: string): string => `${currency}: ${what}`

  expect(units(net), label('net')).toBe(units(income) - units(expense))
  expect(sum(categories.map((row) => row.income)), label('income of the categories')).toBe(units(income))
  expect(sum(categories.map((row) => row.expense)), label('expense of the categories')).toBe(units(expense))
  expect(sum(trend.map((row) => row.income)), label('income of the months')).toBe(units(income))
  expect(sum(trend.map((row) => row.expense)), label('expense of the months')).toBe(units(expense))

  for (const row of [...categories, ...trend]) {
    expect(units(row.net), label('net of a row')).toBe(units(row.income) - units(row.expense))
  }
}

/**
 * Asserts that every currency of an answer adds up (see {@link expectCurrencyAddsUp}).
 *
 * @param body - the answer of `GET /api/dashboard`
 */
export const expectConsistent = ({ currencies }: DashboardBody): void => {
  for (const currency of currencies) {
    expectCurrencyAddsUp(currency)
  }
}

/**
 * Asserts that an answer is worth comparing: it names at least two currencies and some month of some currency has
 * income. Two empty answers are equal, so without this a comparison could pass for nothing.
 *
 * @param body - the answer of `GET /api/dashboard` or of the SQL
 */
export const expectNotEmpty = ({ currencies }: DashboardBody): void => {
  expect(currencies.length, 'currencies in the window').toBeGreaterThanOrEqual(2)
  expect(
    currencies.some(({ trend }) => trend.some(({ income }) => income !== '0.0000')),
    'a month with income',
  ).toBe(true)
}

/**
 * Asks for the dashboard and expects a `200`.
 *
 * @param client - the requests of one user (`as(persona)`)
 * @param period - `3m`, `6m` or `1y`; left out, the API picks its default
 * @returns the body of the answer
 */
export const getDashboard = async (client: Client, period?: string): Promise<DashboardBody> => {
  const response = await client
    .get(period === undefined ? '/api/dashboard' : `/api/dashboard?period=${period}`)
    .expect(200)

  return response.body as DashboardBody
}

/**
 * The currency of an answer with this code.
 *
 * @param body - the answer of `GET /api/dashboard`
 * @param code - three capital letters
 * @returns that currency, or a failed expectation when the answer has none
 */
export const currencyOf = ({ currencies }: DashboardBody, code: string): CurrencyBody => {
  const found = currencies.find(({ currency }) => currency === code)

  if (found === undefined) {
    throw new Error(`The answer has no currency ${code}: ${currencies.map(({ currency }) => currency).join(', ')}`)
  }

  return found
}
