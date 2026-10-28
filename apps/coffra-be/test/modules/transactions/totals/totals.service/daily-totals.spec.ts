import { describe, expect, it } from 'vitest'

import { formatMoney } from '../../../../../src/modules/transactions/common/format-money'
import type { DayTotal } from '../../../../../src/modules/transactions/totals/totals.types'
import { TIME_ZONES, useTimeZone } from '../../../../utils/use-time-zone'

import {
  CZK_1,
  CZK_2,
  dailyExpense,
  dailyIncome,
  dailyQuery,
  EUR_1,
  FROM,
  groupQuery,
  OWNER,
  RANGE,
  TO,
  useTotalsService,
} from './setup'

/** The rows as `currency|day|income|expense`, to compare at a glance. */
const lines = (rows: DayTotal[]): string[] =>
  rows.map(
    ({ currency, date, income: inc, expense: exp }) => `${currency}|${date}|${formatMoney(inc)}|${formatMoney(exp)}`,
  )

describe('TransactionTotalsService.dailyTotals', () => {
  const { service, groupBy, findAccounts, findCategories } = useTotalsService()

  describe('the aggregation', () => {
    it('is one query, grouped by account, type and day, with the filter of the totals by category', async () => {
      await service.dailyTotals(OWNER, RANGE)

      expect(groupBy).toHaveBeenCalledExactlyOnceWith(dailyQuery())
      // The same filter as `categoryTotals`: one place decides the owner, the types and the days.
      expect((groupBy.mock.calls[0]?.[0] as { where: unknown }).where).toStrictEqual(groupQuery().where)
    })

    it('stays within the rows of the owner, through the account', async () => {
      await service.dailyTotals(OWNER, RANGE)

      const { where } = groupBy.mock.calls[0]?.[0] as { where: { account: unknown } }
      expect(where.account).toStrictEqual({ userId: OWNER.userId })
    })

    it('leaves transfers out by asking for income and expense only', async () => {
      await service.dailyTotals(OWNER, RANGE)

      const { where } = groupBy.mock.calls[0]?.[0] as { where: { type: unknown } }
      expect(where.type).toStrictEqual({ in: ['income', 'expense'] })
    })

    it('counts both days of the range, as midnight UTC of each', async () => {
      await service.dailyTotals(OWNER, RANGE)

      const { where } = groupBy.mock.calls[0]?.[0] as { where: { date: { gte: Date; lte: Date } } }
      expect(where.date.gte.toISOString()).toBe(FROM.toISOString())
      expect(where.date.lte.toISOString()).toBe(TO.toISOString())
    })

    it('passes a range whose first day is after the last on to the database, which finds nothing', async () => {
      await expect(service.dailyTotals(OWNER, { from: '2026-10-31', to: '2026-08-01' })).resolves.toStrictEqual([])

      expect(groupBy).toHaveBeenCalledExactlyOnceWith(
        dailyQuery(new Date('2026-10-31T00:00:00.000Z'), new Date('2026-08-01T00:00:00.000Z')),
      )
    })

    it('passes a failure of the aggregation on unchanged', async () => {
      const failure = new Error('connection lost')
      groupBy.mockRejectedValue(failure)

      await expect(service.dailyTotals(OWNER, RANGE)).rejects.toBe(failure)
    })

    it('fails on a null sum: a group has at least one row and the amount is never null', async () => {
      findAccounts.mockResolvedValue([{ id: CZK_1, currency: 'CZK' }])
      groupBy.mockResolvedValue([{ ...dailyIncome(CZK_1, '2026-09-01', '1'), _sum: { amount: null } }])

      await expect(service.dailyTotals(OWNER, RANGE)).rejects.toThrow('The sum of a group of transactions is null')
    })

    // 23:30 UTC on the 22nd is already the 23rd in Pacific/Kiritimati and still the 22nd in Pacific/Pago_Pago.
    describe.each(TIME_ZONES)('on a server in the time zone %s', (zone, offset) => {
      useTimeZone(zone, offset)

      it('bounds the range at the same instants as on a server in UTC', async () => {
        await service.dailyTotals(OWNER, { from: '2026-10-22', to: '2026-10-23' })

        expect(groupBy).toHaveBeenCalledExactlyOnceWith(
          dailyQuery(new Date('2026-10-22T00:00:00.000Z'), new Date('2026-10-23T00:00:00.000Z')),
        )
      })

      it('names the days of the sums as the database stored them', async () => {
        findAccounts.mockResolvedValue([{ id: CZK_1, currency: 'CZK' }])
        groupBy.mockResolvedValue([
          dailyExpense(CZK_1, '2026-10-22', '1'),
          dailyExpense(CZK_1, '2026-10-23', '2'),
          dailyExpense(CZK_1, '2024-02-29', '4'),
        ])

        const rows = await service.dailyTotals(OWNER, RANGE)

        expect(rows.map(({ date }) => date)).toStrictEqual(['2024-02-29', '2026-10-22', '2026-10-23'])
      })
    })
  })

  describe('with nothing to add up', () => {
    it('returns an empty list and reads no account', async () => {
      await expect(service.dailyTotals(OWNER, RANGE)).resolves.toStrictEqual([])

      expect(findAccounts).not.toHaveBeenCalled()
    })
  })

  describe('the accounts read for the sums', () => {
    it('are read within the owner scope, by the ids the sums refer to, each id once', async () => {
      groupBy.mockResolvedValue([
        dailyIncome(CZK_1, '2026-09-01', '1'),
        dailyExpense(CZK_1, '2026-09-01', '1'),
        dailyExpense(CZK_2, '2026-09-02', '1'),
        dailyExpense(EUR_1, '2026-09-03', '1'),
      ])
      findAccounts.mockResolvedValue([
        { id: CZK_1, currency: 'CZK' },
        { id: CZK_2, currency: 'CZK' },
        { id: EUR_1, currency: 'EUR' },
      ])

      await service.dailyTotals(OWNER, RANGE)

      expect(findAccounts).toHaveBeenCalledExactlyOnceWith({
        where: { id: { in: [CZK_1, CZK_2, EUR_1] }, userId: OWNER.userId },
        select: { id: true, currency: true },
      })
    })

    it('are two queries however many accounts and days there are, and no category is read', async () => {
      const accounts = Array.from({ length: 20 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
      groupBy.mockResolvedValue(
        accounts.map((id, i) => dailyExpense(id, `2026-09-${String((i % 28) + 1).padStart(2, '0')}`, '1')),
      )
      findAccounts.mockResolvedValue(accounts.map((id) => ({ id, currency: 'CZK' })))

      await service.dailyTotals(OWNER, RANGE)

      expect(groupBy).toHaveBeenCalledTimes(1)
      expect(findAccounts).toHaveBeenCalledTimes(1)
      expect(findCategories).not.toHaveBeenCalled()
    })

    it('are not read when the aggregation fails', async () => {
      groupBy.mockRejectedValue(new Error('connection lost'))

      await expect(service.dailyTotals(OWNER, RANGE)).rejects.toThrow('connection lost')

      expect(findAccounts).not.toHaveBeenCalled()
    })

    it('pass a failure of the read on unchanged', async () => {
      const failure = new Error('connection lost')
      groupBy.mockResolvedValue([dailyExpense(CZK_1, '2026-09-01', '1')])
      findAccounts.mockRejectedValue(failure)

      await expect(service.dailyTotals(OWNER, RANGE)).rejects.toBe(failure)
    })
  })

  describe('the rows', () => {
    it('are the sums folded by currency and day, with the currencies that were read', async () => {
      groupBy.mockResolvedValue([
        dailyExpense(CZK_1, '2026-09-01', '100'),
        dailyExpense(CZK_2, '2026-09-01', '50.5'),
        dailyIncome(CZK_2, '2026-09-05', '5000'),
        dailyExpense(EUR_1, '2026-09-01', '10'),
      ])
      findAccounts.mockResolvedValue([
        { id: CZK_1, currency: 'CZK' },
        { id: CZK_2, currency: 'CZK' },
        { id: EUR_1, currency: 'EUR' },
      ])

      const rows = await service.dailyTotals(OWNER, RANGE)

      expect(lines(rows)).toStrictEqual([
        'CZK|2026-09-01|0.0000|150.5000',
        'CZK|2026-09-05|5000.0000|0.0000',
        'EUR|2026-09-01|0.0000|10.0000',
      ])
    })

    it('are the same whatever order the database returned the sums in', async () => {
      const groups = [
        dailyExpense(CZK_1, '2026-09-02', '1'),
        dailyIncome(CZK_1, '2026-09-01', '2'),
        dailyExpense(EUR_1, '2026-09-01', '3'),
      ]
      findAccounts.mockResolvedValue([
        { id: CZK_1, currency: 'CZK' },
        { id: EUR_1, currency: 'EUR' },
      ])
      groupBy.mockResolvedValue(groups)
      const forward = await service.dailyTotals(OWNER, RANGE)

      groupBy.mockResolvedValue(groups.toReversed())
      const backward = await service.dailyTotals(OWNER, RANGE)

      expect(lines(backward)).toStrictEqual(lines(forward))
    })
  })

  describe('a broken invariant', () => {
    it('fails for a sum of an account the owner does not have, instead of guessing its currency', async () => {
      groupBy.mockResolvedValue([dailyExpense(CZK_1, '2026-09-01', '1')])

      await expect(service.dailyTotals(OWNER, RANGE)).rejects.toThrow(
        'A group of transactions belongs to an account that was not read',
      )
    })
  })
})
