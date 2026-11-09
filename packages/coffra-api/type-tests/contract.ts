// A type-level check of the coffra-be contract, run by `pnpm ts` (outside `src/`, so not in `dist`). Each call compiles
// only while the generated types say what the API does; each `@ts-expect-error` fails the check once the types allow
// what the API refuses. Nothing here runs.

import { createApi } from '../src'

const { fetchClient, $api } = createApi('https://api.invalid')

/**
 * Compiles only when `value` is a `T`.
 *
 * @param value - the value to check
 * @returns the value
 */
const expectType = <T>(value: T): T => value

/**
 * Money comes out as a decimal string, never a number.
 *
 * @param id - id of an account
 */
export const balance = async (id: string): Promise<void> => {
  const { data } = await fetchClient.GET('/api/accounts/{id}', { params: { path: { id } } })

  expectType<string | undefined>(data?.balance)
  // @ts-expect-error -- the balance is a string
  expectType<number | undefined>(data?.balance)
}

/**
 * Money goes in as a decimal string, never a number.
 *
 * @param fromAccountId - id of the source account
 * @param toAccountId - id of the target account
 */
export const transfer = async (fromAccountId: string, toAccountId: string): Promise<void> => {
  const fields = { fromAccountId, toAccountId, date: '2026-11-03' }

  await fetchClient.POST('/api/transfers', { body: { ...fields, amount: '12.5000' } })
  // @ts-expect-error -- the amount is a string
  await fetchClient.POST('/api/transfers', { body: { ...fields, amount: 12.5 } })
}

/**
 * A transaction may have no category.
 *
 * @param id - id of a transaction
 */
export const category = async (id: string): Promise<void> => {
  const { data } = await fetchClient.GET('/api/transactions/{id}', { params: { path: { id } } })

  expectType<string | null | undefined>(data?.categoryId)
  // @ts-expect-error -- the category can be null
  expectType<string | undefined>(data?.categoryId)
}

/** The dashboard has three periods and nothing else. */
export const dashboard = (): void => {
  $api.queryOptions('get', '/api/dashboard', { params: { query: { period: '6m' } } })
  // @ts-expect-error -- not a period of the dashboard
  $api.queryOptions('get', '/api/dashboard', { params: { query: { period: '2y' } } })
}

/** A route the API does not have cannot be called. */
export const unknownRoute = async (): Promise<void> => {
  // @ts-expect-error -- no such route
  await fetchClient.GET('/api/nope')
}

/**
 * The public routes are there too: a refresh takes the refresh token in the body and answers with a new pair.
 *
 * @param refreshToken - the refresh token of the session
 */
export const refresh = async (refreshToken: string): Promise<void> => {
  const { data } = await fetchClient.POST('/api/auth/refresh', { body: { refreshToken } })

  expectType<string | undefined>(data?.accessToken)
}
