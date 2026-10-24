import { describe, expect, it } from 'vitest'

import { TransactionType } from '../../../../../src/modules/prisma'
import { decodeListCursor } from '../../../../../src/modules/transactions/transactions/transactions.cursor'
import type {
  ListCursor,
  ListTransactionsInput,
} from '../../../../../src/modules/transactions/transactions/transactions.types'
import { TIME_ZONES, useTimeZone } from '../../../../utils/use-time-zone'

import { ACCOUNT_ID, CATEGORY_ID, OWNER, PAIR_ID, row, transferRow, useTransactionsService, VIEW } from './setup'

/** The first page with nothing filtered, as the controller hands it over with the defaults. */
const FIRST_PAGE: ListTransactionsInput = { order: 'desc', limit: 50 }

/** The owner scope through the account: in the `where` of every list. */
const SCOPE = { account: { userId: OWNER.userId } }

const CURSOR: ListCursor = {
  order: 'desc',
  date: '2026-10-19',
  createdAt: '2026-10-19T08:00:00.123Z',
  id: '9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d',
}

const DAY = new Date('2026-10-19T00:00:00.000Z')
const AT = new Date('2026-10-19T08:00:00.123Z')

/** `count` rows of one day, one millisecond apart, in the order the database returns them for `desc`. */
const rows = (count: number) =>
  Array.from({ length: count }, (_, index) =>
    row({
      id: `9a8b7c6d-5e4f-4a3b-9c2d-${String(index).padStart(12, '0')}`,
      createdAt: new Date(`2026-10-19T08:00:00.${String(999 - index).padStart(3, '0')}Z`),
    }),
  )

describe('TransactionsService.list', () => {
  const { service, findMany } = useTransactionsService()

  const query = () => findMany.mock.calls[0]?.[0] as { where: unknown; orderBy: unknown; take: unknown }

  describe('the filter', () => {
    it('asks only for the rows of the owner, through their account, when nothing else filters', async () => {
      await service.list(OWNER, FIRST_PAGE)

      expect(findMany).toHaveBeenCalledOnce()
      expect(query().where).toStrictEqual(SCOPE)
    })

    it.each([
      ['an account', { accountId: ACCOUNT_ID }],
      ['a category', { categoryId: CATEGORY_ID }],
      ['a type', { type: TransactionType.transfer }],
    ])('adds %s next to the scope, never in place of it', async (_name, filter) => {
      await service.list(OWNER, { ...FIRST_PAGE, ...filter })

      expect(query().where).toStrictEqual({ ...SCOPE, ...filter })
    })

    it.each([
      ['from a day on', { from: '2026-10-01' }, { gte: new Date('2026-10-01T00:00:00.000Z') }],
      ['up to a day', { to: '2026-10-31' }, { lte: new Date('2026-10-31T00:00:00.000Z') }],
      [
        'between two days',
        { from: '2026-10-01', to: '2026-10-31' },
        { gte: new Date('2026-10-01T00:00:00.000Z'), lte: new Date('2026-10-31T00:00:00.000Z') },
      ],
      ['for one day', { from: '2026-10-19', to: '2026-10-19' }, { gte: DAY, lte: DAY }],
    ])('keeps the rows %s, both ends inclusive, at midnight UTC of the day', async (_name, range, date) => {
      await service.list(OWNER, { ...FIRST_PAGE, ...range })

      expect(query().where).toStrictEqual({ ...SCOPE, date })
    })

    it('combines every filter, the range and the cursor', async () => {
      await service.list(OWNER, {
        ...FIRST_PAGE,
        accountId: ACCOUNT_ID,
        categoryId: CATEGORY_ID,
        type: TransactionType.expense,
        from: '2026-10-01',
        to: '2026-10-31',
        cursor: CURSOR,
      })

      expect(query().where).toStrictEqual({
        ...SCOPE,
        accountId: ACCOUNT_ID,
        categoryId: CATEGORY_ID,
        type: TransactionType.expense,
        date: { gte: new Date('2026-10-01T00:00:00.000Z'), lte: new Date('2026-10-31T00:00:00.000Z') },
        AND: [
          { date: { lte: DAY } },
          { OR: [{ date: { lt: DAY } }, { createdAt: { lt: AT } }, { createdAt: AT, id: { lt: CURSOR.id } }] },
        ],
      })
    })

    describe.each(TIME_ZONES)('in the time zone %s', (zone, offset) => {
      useTimeZone(zone, offset)

      it('bounds the range and the cursor at the same instants as on a server in UTC', async () => {
        await service.list(OWNER, { ...FIRST_PAGE, from: '2026-10-01', to: '2026-10-31', cursor: CURSOR })

        const { where } = query() as { where: { date: { gte: Date; lte: Date }; AND: unknown } }
        expect(where.date.gte.toISOString()).toBe('2026-10-01T00:00:00.000Z')
        expect(where.date.lte.toISOString()).toBe('2026-10-31T00:00:00.000Z')
        expect(JSON.stringify(where.AND)).toBe(
          JSON.stringify([
            { date: { lte: '2026-10-19T00:00:00.000Z' } },
            {
              OR: [
                { date: { lt: '2026-10-19T00:00:00.000Z' } },
                { createdAt: { lt: '2026-10-19T08:00:00.123Z' } },
                { createdAt: '2026-10-19T08:00:00.123Z', id: { lt: CURSOR.id } },
              ],
            },
          ]),
        )
      })
    })
  })

  describe('the order and the cursor', () => {
    it.each(['desc', 'asc'] as const)('orders %s by date, then createdAt, then id: a total order', async (order) => {
      await service.list(OWNER, { ...FIRST_PAGE, order })

      expect(query().orderBy).toStrictEqual([{ date: order }, { createdAt: order }, { id: order }])
    })

    it('starts after the cursor of a desc list: an earlier day, or the same day and an earlier key', async () => {
      await service.list(OWNER, { ...FIRST_PAGE, cursor: CURSOR })

      expect(query().where).toStrictEqual({
        ...SCOPE,
        AND: [
          { date: { lte: DAY } },
          { OR: [{ date: { lt: DAY } }, { createdAt: { lt: AT } }, { createdAt: AT, id: { lt: CURSOR.id } }] },
        ],
      })
    })

    it('starts after the cursor of an asc list: a later day, or the same day and a later key', async () => {
      await service.list(OWNER, { ...FIRST_PAGE, order: 'asc', cursor: { ...CURSOR, order: 'asc' } })

      expect(query().where).toStrictEqual({
        ...SCOPE,
        AND: [
          { date: { gte: DAY } },
          { OR: [{ date: { gt: DAY } }, { createdAt: { gt: AT } }, { createdAt: AT, id: { gt: CURSOR.id } }] },
        ],
      })
    })

    it('keeps the range filter next to the cursor: both bound the date, neither replaces the other', async () => {
      await service.list(OWNER, { ...FIRST_PAGE, to: '2026-10-31', cursor: CURSOR })

      const { where } = query() as { where: { date: unknown; AND: [{ date: unknown }] } }
      expect(where.date).toStrictEqual({ lte: new Date('2026-10-31T00:00:00.000Z') })
      expect(where.AND[0].date).toStrictEqual({ lte: DAY })
    })
  })

  describe('the page', () => {
    it.each([50, 7, 1, 100])('asks for one row more than the limit %i', async (limit) => {
      await service.list(OWNER, { ...FIRST_PAGE, limit })

      expect(query().take).toBe(limit + 1)
    })

    it('returns the rows up to the limit and the cursor of the last one it returns', async () => {
      const found = rows(8)
      findMany.mockResolvedValue(found)

      const page = await service.list(OWNER, { ...FIRST_PAGE, limit: 7 })

      expect(page.items.map(({ id }) => id)).toEqual(found.slice(0, 7).map(({ id }) => id))
      expect(decodeListCursor(page.nextCursor)).toStrictEqual({
        order: 'desc',
        date: '2026-10-19',
        createdAt: found[6]?.createdAt.toISOString(),
        id: found[6]?.id,
      })
    })

    it('issues the cursor for the order of the list', async () => {
      findMany.mockResolvedValue(rows(2))

      const page = await service.list(OWNER, { ...FIRST_PAGE, order: 'asc', limit: 1 })

      expect(decodeListCursor(page.nextCursor)).toMatchObject({ order: 'asc' })
    })

    it.each([
      ['exactly the limit', 7],
      ['fewer rows than the limit', 3],
    ])('has no next page with %s', async (_name, count) => {
      findMany.mockResolvedValue(rows(count))

      const page = await service.list(OWNER, { ...FIRST_PAGE, limit: 7 })

      expect(page.items).toHaveLength(count)
      expect(page.nextCursor).toBeNull()
    })

    it('maps every row to the view, in the order the database returned them, transfer sides included', async () => {
      findMany.mockResolvedValue([row(), transferRow()])

      const page = await service.list(OWNER, FIRST_PAGE)

      expect(page.items).toStrictEqual([
        VIEW,
        {
          ...VIEW,
          type: 'transfer',
          note: null,
          categoryId: null,
          transferPairId: PAIR_ID,
          transferDirection: 'out',
        },
      ])
    })

    it('returns an empty page, without a cursor, when nothing matches', async () => {
      await expect(service.list(OWNER, FIRST_PAGE)).resolves.toStrictEqual({ items: [], nextCursor: null })
    })

    it('lets an error of the query through as it is', async () => {
      const failure = new Error('connection lost')
      findMany.mockRejectedValue(failure)

      await expect(service.list(OWNER, FIRST_PAGE)).rejects.toBe(failure)
    })
  })
})
