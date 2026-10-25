import { describe, expect, it, vi } from 'vitest'

import { CALENDAR_DAYS, useTimeZone } from '../../utils/use-time-zone'
import { useIntegrationApp } from '../support/use-integration-app'

/** The two ends of the offsets, a day apart: the app runs in the process of the spec, so this is the zone of the server. */
const ZONES: [zone: string, offset: number][] = [
  ['Pacific/Kiritimati', -840],
  ['Pacific/Pago_Pago', 660],
]

/**
 * Moves the process (and so the app) to another time zone, and checks that the move took effect.
 *
 * @param zone - IANA zone name
 * @param offset - the `getTimezoneOffset()` the zone gives on 2026-01-15
 */
const setZone = (zone: string, offset: number): void => {
  vi.stubEnv('TZ', zone)
  expect(new Date('2026-01-15T12:00:00Z').getTimezoneOffset()).toBe(offset)
}

// A calendar day goes through the driver adapter into a `DATE` column and back without moving, whatever the time zone
// of the server: the unit specs prove our side (`parseIsoDate` / `formatIsoDate`), this proves the adapter.
describe('a calendar day through the database', () => {
  const { as, world, prisma } = useIntegrationApp()

  /** The days of rows as Postgres stores them, by `date::text`. */
  const storedDays = async (where: { id?: string; pairId?: string }): Promise<string[]> => {
    const rows =
      where.id === undefined
        ? await prisma().$queryRaw<{ day: string }[]>`
            SELECT date::text AS day FROM "Transaction" WHERE "transferPairId" = ${where.pairId}::uuid`
        : await prisma().$queryRaw<
            { day: string }[]
          >`SELECT date::text AS day FROM "Transaction" WHERE id = ${where.id}::uuid`

    return rows.map(({ day }) => day)
  }

  describe.each(ZONES)('with the server in %s', (zone, offset) => {
    useTimeZone(zone, offset)

    it.each(CALENDAR_DAYS)('keeps %s on a transaction', async (day) => {
      const { a } = world()

      const created = await as(a)
        .post('/api/transactions', { accountId: a.accounts.main, type: 'income', amount: '1', date: day })
        .expect(201)
      const { id } = created.body as { id: string; date: string }
      const read = await as(a).get(`/api/transactions/${id}`).expect(200)

      expect((created.body as { date: string }).date).toBe(day)
      expect(await storedDays({ id })).toStrictEqual([day])
      expect((read.body as { date: string }).date).toBe(day)
    })

    it.each(CALENDAR_DAYS)('keeps %s on both sides of a transfer', async (day) => {
      const { a } = world()

      const created = await as(a)
        .post('/api/transfers', {
          fromAccountId: a.accounts.main,
          toAccountId: a.accounts.savings,
          amount: '1',
          date: day,
        })
        .expect(201)
      const { pairId, date } = created.body as { pairId: string; date: string }

      expect(date).toBe(day)
      expect(await storedDays({ pairId })).toStrictEqual([day, day])
    })

    it.each(CALENDAR_DAYS)('finds %s by a filter of exactly that day', async (day) => {
      const { a } = world()
      const created = await as(a)
        .post('/api/transactions', { accountId: a.accounts.empty, type: 'expense', amount: '1', date: day })
        .expect(201)

      const page = await as(a).get(`/api/transactions?accountId=${a.accounts.empty}&from=${day}&to=${day}`).expect(200)

      expect((page.body as { items: { id: string }[] }).items.map(({ id }) => id)).toStrictEqual([
        (created.body as { id: string }).id,
      ])
    })
  })

  it('reads in one zone the days written in the other', async () => {
    const { a } = world()
    const written: [id: string, day: string][] = []

    setZone('Pacific/Kiritimati', -840)
    for (const day of CALENDAR_DAYS) {
      const created = await as(a)
        .post('/api/transactions', { accountId: a.accounts.empty, type: 'income', amount: '1', date: day })
        .expect(201)
      written.push([(created.body as { id: string }).id, day])
    }

    setZone('Pacific/Pago_Pago', 660)
    for (const [id, day] of written) {
      const read = await as(a).get(`/api/transactions/${id}`).expect(200)

      expect((read.body as { date: string }).date).toBe(day)
      expect(await storedDays({ id })).toStrictEqual([day])
    }
  })
})
