import type { PrismaService } from '../../../src/modules/prisma'

import type { Persona } from './world'

/**
 * The body Nest answers for a `ConflictException`.
 *
 * @param message - the message the service throws
 * @returns the expected response body
 */
export const conflict = (message: string): { statusCode: 409; error: 'Conflict'; message: string } => ({
  statusCode: 409,
  error: 'Conflict',
  message,
})

/**
 * Balances by account id, from a list of accounts in a response.
 *
 * @param body - the body of `GET /api/accounts` (`response.body`, untyped)
 * @returns `{ [accountId]: balance }`
 */
export const balancesOf = (body: unknown): Record<string, string> =>
  Object.fromEntries((body as { id: string; balance: string }[]).map(({ id, balance }) => [id, balance]))

/**
 * The balances the seed gives a user, by account id.
 *
 * @param persona - the user
 * @returns `{ [accountId]: balance }`
 */
export const seededBalances = (persona: Persona): Record<string, string> =>
  Object.fromEntries(
    Object.entries(persona.accounts).map(([name, id]) => [id, persona.balances[name as keyof Persona['balances']]]),
  )

/**
 * The balances of a user computed by plain SQL, independently of the app: opening balance plus income and incoming
 * transfers minus expenses and outgoing transfers, dated up to `asOf`.
 *
 * @param prisma - the client of the app under test
 * @param userId - whose accounts
 * @param asOf - last day counted, inclusive (`YYYY-MM-DD`)
 * @returns `{ [accountId]: balance }` with four decimal places
 */
export const sqlBalances = async (
  prisma: PrismaService,
  userId: string,
  asOf: string,
): Promise<Record<string, string>> => {
  const rows = await prisma.$queryRaw<{ id: string; balance: string }[]>`
    SELECT a.id::text AS id,
           (a."openingBalance" + COALESCE(SUM(CASE WHEN t.type = 'income' OR t."transferDirection" = 'in'
                                                   THEN t.amount ELSE -t.amount END), 0))::text AS balance
      FROM "Account" a
      LEFT JOIN "Transaction" t ON t."accountId" = a.id AND t.date <= ${asOf}::date
     WHERE a."userId" = ${userId}::uuid
     GROUP BY a.id`

  return Object.fromEntries(rows.map(({ id, balance }) => [id, balance]))
}
