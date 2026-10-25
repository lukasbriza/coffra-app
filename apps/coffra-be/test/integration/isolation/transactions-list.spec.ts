import { randomUUID } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { encodeListCursor } from '../../../src/modules/transactions/transactions/transactions.cursor'
import { parseIsoDate } from '../../../src/utils'
import { useIntegrationApp } from '../support/use-integration-app'
import type { Persona } from '../support/world'

type Page = { items: { id: string }[]; nextCursor: string | null }

/**
 * Every row a user has at the start: the income, the expense and both sides of the transfer.
 *
 * @param persona - the user
 * @returns the ids, sorted
 */
const rowsOf = (persona: Persona): string[] =>
  [persona.transactions.income, persona.transactions.expense, persona.transfer.out, persona.transfer.in].toSorted()

/**
 * The ids of a page, in the order of the page.
 *
 * @param page - a page of the list
 * @returns the ids
 */
const ids = (page: Page): string[] => page.items.map(({ id }) => id)

describe('isolation of the transactions list', () => {
  const { as, anonymous, world, prisma } = useIntegrationApp()

  const list = async (persona: Persona, query = ''): Promise<Page> => {
    const response = await as(persona).get(`/api/transactions${query}`).expect(200)

    return response.body as Page
  }

  it('turns a request without a token away', async () => {
    await anonymous().get('/api/transactions').expect(401)
  })

  describe('GET /api/transactions', () => {
    it('lists only the rows of the caller, both sides of their transfer included', async () => {
      const { a } = world()

      const page = await list(a)

      expect(ids(page).toSorted()).toStrictEqual(rowsOf(a))
      expect(page.nextCursor).toBeNull()
    })

    it('lists only the rows of the other user for them (control)', async () => {
      const { b } = world()

      expect(ids(await list(b)).toSorted()).toStrictEqual(rowsOf(b))
    })

    it('gives an empty page for an account of another user, the same as for an id nobody has', async () => {
      const { a, b } = world()

      const foreign = await list(a, `?accountId=${b.accounts.main}`)
      const missing = await list(a, `?accountId=${randomUUID()}`)

      expect(foreign).toStrictEqual({ items: [], nextCursor: null })
      expect(missing).toStrictEqual(foreign)
    })

    it('filters by an own account (control)', async () => {
      const { a } = world()

      const page = await list(a, `?accountId=${a.accounts.main}`)

      expect(ids(page).toSorted()).toStrictEqual(
        [a.transactions.income, a.transactions.expense, a.transfer.out].toSorted(),
      )
    })

    it('gives an empty page for a category of another user, the same as for an id nobody has', async () => {
      const { a, b } = world()

      const foreign = await list(a, `?categoryId=${b.categories.food}`)
      const missing = await list(a, `?categoryId=${randomUUID()}`)

      expect(foreign).toStrictEqual({ items: [], nextCursor: null })
      expect(missing).toStrictEqual(foreign)
    })

    it('filters by an own category (control)', async () => {
      const { a } = world()

      expect(ids(await list(a, `?categoryId=${a.categories.food}`))).toStrictEqual([a.transactions.expense])
    })

    it('keeps the other user out of the filters by type and by days', async () => {
      const { a } = world()

      const transfers = await list(a, '?type=transfer')
      const days = await list(a, '?from=2026-01-01&to=2026-01-31')

      expect(ids(transfers).toSorted()).toStrictEqual([a.transfer.out, a.transfer.in].toSorted())
      expect(ids(days).toSorted()).toStrictEqual(rowsOf(a))
    })

    it('continues after the values of a cursor, never after the row of the other user it names', async () => {
      const { a, b } = world()
      const row = await prisma().transaction.findUniqueOrThrow({ where: { id: b.transactions.expense } })
      // The sort key of a row of `b`, moved to a day between the seeded expense and transfer: in `desc` order the
      // next page holds what comes before that day. The id in it is a row of `b`; nothing is looked up by it.
      const cursor = encodeListCursor({ ...row, date: parseIsoDate('2026-01-13') }, 'desc')

      const pageOfA = await list(a, `?cursor=${cursor}`)
      const pageOfB = await list(b, `?cursor=${cursor}`)

      expect(ids(pageOfA)).toStrictEqual([a.transactions.expense, a.transactions.income])
      expect(ids(pageOfB)).toStrictEqual([b.transactions.expense, b.transactions.income])
    })

    it('pages through exactly the rows of the caller', async () => {
      const { a } = world()
      const seen: string[] = []
      let cursor: string | null = null

      do {
        const page: Page = await list(a, `?limit=1${cursor === null ? '' : `&cursor=${cursor}`}`)
        expect(page.items).toHaveLength(1)
        seen.push(...ids(page))
        cursor = page.nextCursor
      } while (cursor !== null)

      expect(seen.toSorted()).toStrictEqual(rowsOf(a))
    })
  })
})
