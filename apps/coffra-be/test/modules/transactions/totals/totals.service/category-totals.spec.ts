import { describe, expect, it } from 'vitest'

import { formatMoney } from '../../../../../src/modules/transactions/common/format-money'
import type { CategoryTotal } from '../../../../../src/modules/transactions/totals/totals.types'
import { TIME_ZONES, useTimeZone } from '../../../../utils/use-time-zone'

import {
  CZK_1,
  CZK_2,
  EUR_1,
  expense,
  FOOD,
  FROM,
  groupQuery,
  income,
  OWNER,
  RANGE,
  SALARY,
  TO,
  useTotalsService,
} from './setup'

const FOREIGN_CATEGORY = '44444444-4444-4444-8444-444444444444'

/** The rows as `currency|category|income|expense`, to compare at a glance. */
const lines = (rows: CategoryTotal[]): string[] =>
  rows.map(
    ({ currency, category, income: inc, expense: exp }) =>
      `${currency}|${category?.name ?? '-'}|${formatMoney(inc)}|${formatMoney(exp)}`,
  )

describe('TransactionTotalsService.categoryTotals', () => {
  const { service, groupBy, findAccounts, findCategories } = useTotalsService()

  describe('the aggregation', () => {
    it('is one query, grouped by account, category and type, with nothing else in the filter', async () => {
      await service.categoryTotals(OWNER, RANGE)

      expect(groupBy).toHaveBeenCalledExactlyOnceWith(groupQuery())
    })

    it('stays within the rows of the owner, through the account', async () => {
      await service.categoryTotals(OWNER, RANGE)

      const { where } = groupBy.mock.calls[0]?.[0] as { where: { account: unknown } }
      expect(where.account).toStrictEqual({ userId: OWNER.userId })
    })

    it('leaves transfers out by asking for income and expense only', async () => {
      await service.categoryTotals(OWNER, RANGE)

      const { where } = groupBy.mock.calls[0]?.[0] as { where: { type: unknown } }
      expect(where.type).toStrictEqual({ in: ['income', 'expense'] })
    })

    it('counts both days of the range, as midnight UTC of each', async () => {
      await service.categoryTotals(OWNER, RANGE)

      const { where } = groupBy.mock.calls[0]?.[0] as { where: { date: { gte: Date; lte: Date } } }
      expect(where.date.gte.toISOString()).toBe(FROM.toISOString())
      expect(where.date.lte.toISOString()).toBe(TO.toISOString())
    })

    it('takes one day as a range of its own', async () => {
      await service.categoryTotals(OWNER, { from: '2026-09-15', to: '2026-09-15' })

      const { where } = groupBy.mock.calls[0]?.[0] as { where: { date: { gte: Date; lte: Date } } }
      expect(where.date.gte.toISOString()).toBe('2026-09-15T00:00:00.000Z')
      expect(where.date.lte.toISOString()).toBe('2026-09-15T00:00:00.000Z')
    })

    it('passes a range whose first day is after the last on to the database, which finds nothing', async () => {
      await expect(service.categoryTotals(OWNER, { from: '2026-10-31', to: '2026-08-01' })).resolves.toStrictEqual([])

      expect(groupBy).toHaveBeenCalledExactlyOnceWith(
        groupQuery(new Date('2026-10-31T00:00:00.000Z'), new Date('2026-08-01T00:00:00.000Z')),
      )
    })

    it('passes a failure of the aggregation on unchanged', async () => {
      const failure = new Error('connection lost')
      groupBy.mockRejectedValue(failure)

      await expect(service.categoryTotals(OWNER, RANGE)).rejects.toBe(failure)
    })

    it('fails on a null sum: a group has at least one row and the amount is never null', async () => {
      findAccounts.mockResolvedValue([{ id: CZK_1, currency: 'CZK' }])
      groupBy.mockResolvedValue([{ ...income(CZK_1, null, '1'), _sum: { amount: null } }])

      await expect(service.categoryTotals(OWNER, RANGE)).rejects.toThrow('The sum of a group of transactions is null')
    })

    // 23:30 UTC on the 22nd is already the 23rd in Pacific/Kiritimati and still the 22nd in Pacific/Pago_Pago.
    describe.each(TIME_ZONES)('on a server in the time zone %s', (zone, offset) => {
      useTimeZone(zone, offset)

      it('bounds the range at the same instants as on a server in UTC', async () => {
        await service.categoryTotals(OWNER, { from: '2026-10-22', to: '2026-10-23' })

        expect(groupBy).toHaveBeenCalledExactlyOnceWith(
          groupQuery(new Date('2026-10-22T00:00:00.000Z'), new Date('2026-10-23T00:00:00.000Z')),
        )
      })
    })
  })

  describe('with nothing to add up', () => {
    it('returns an empty list and reads no account and no category', async () => {
      await expect(service.categoryTotals(OWNER, RANGE)).resolves.toStrictEqual([])

      expect(findAccounts).not.toHaveBeenCalled()
      expect(findCategories).not.toHaveBeenCalled()
    })
  })

  describe('the accounts and the categories read for the sums', () => {
    it('are read within the owner scope, by the ids the sums refer to, each id once', async () => {
      groupBy.mockResolvedValue([
        income(CZK_1, SALARY, '1'),
        expense(CZK_1, FOOD, '1'),
        expense(CZK_2, FOOD, '1'),
        expense(EUR_1, null, '1'),
      ])
      findAccounts.mockResolvedValue([
        { id: CZK_1, currency: 'CZK' },
        { id: CZK_2, currency: 'CZK' },
        { id: EUR_1, currency: 'EUR' },
      ])
      findCategories.mockResolvedValue([
        { id: SALARY, name: 'Salary' },
        { id: FOOD, name: 'Food' },
      ])

      await service.categoryTotals(OWNER, RANGE)

      expect(findAccounts).toHaveBeenCalledExactlyOnceWith({
        where: { id: { in: [CZK_1, CZK_2, EUR_1] }, userId: OWNER.userId },
        select: { id: true, currency: true },
      })
      expect(findCategories).toHaveBeenCalledExactlyOnceWith({
        where: { id: { in: [SALARY, FOOD] }, userId: OWNER.userId },
        select: { id: true, name: true },
      })
    })

    it('are two queries however many accounts and categories there are', async () => {
      const accounts = Array.from({ length: 20 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
      const categories = Array.from({ length: 10 }, (_, i) => `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
      groupBy.mockResolvedValue(accounts.map((id, i) => expense(id, categories[i % 10] ?? null, '1')))
      findAccounts.mockResolvedValue(accounts.map((id) => ({ id, currency: 'CZK' })))
      findCategories.mockResolvedValue(categories.map((id, i) => ({ id, name: `Category ${i}` })))

      await service.categoryTotals(OWNER, RANGE)

      expect(groupBy).toHaveBeenCalledTimes(1)
      expect(findAccounts).toHaveBeenCalledTimes(1)
      expect(findCategories).toHaveBeenCalledTimes(1)
    })

    it('leave out the categories when no transaction has one', async () => {
      groupBy.mockResolvedValue([expense(CZK_1, null, '5')])
      findAccounts.mockResolvedValue([{ id: CZK_1, currency: 'CZK' }])

      await expect(service.categoryTotals(OWNER, RANGE)).resolves.toMatchObject([{ currency: 'CZK', category: null }])

      expect(findCategories).not.toHaveBeenCalled()
    })

    it('never ask for the id of no category', async () => {
      groupBy.mockResolvedValue([expense(CZK_1, null, '5'), expense(CZK_1, FOOD, '1')])
      findAccounts.mockResolvedValue([{ id: CZK_1, currency: 'CZK' }])
      findCategories.mockResolvedValue([{ id: FOOD, name: 'Food' }])

      await service.categoryTotals(OWNER, RANGE)

      expect(findCategories).toHaveBeenCalledExactlyOnceWith({
        where: { id: { in: [FOOD] }, userId: OWNER.userId },
        select: { id: true, name: true },
      })
    })

    it('are not read when the aggregation fails', async () => {
      groupBy.mockRejectedValue(new Error('connection lost'))

      await expect(service.categoryTotals(OWNER, RANGE)).rejects.toThrow('connection lost')

      expect(findAccounts).not.toHaveBeenCalled()
      expect(findCategories).not.toHaveBeenCalled()
    })

    it('pass a failure of a read on unchanged', async () => {
      const failure = new Error('connection lost')
      groupBy.mockResolvedValue([expense(CZK_1, FOOD, '1')])
      findAccounts.mockResolvedValue([{ id: CZK_1, currency: 'CZK' }])
      findCategories.mockRejectedValue(failure)

      await expect(service.categoryTotals(OWNER, RANGE)).rejects.toBe(failure)
    })
  })

  describe('the rows', () => {
    it('are the sums folded by currency and category, with the names that were read', async () => {
      groupBy.mockResolvedValue([
        expense(CZK_1, FOOD, '100'),
        expense(CZK_2, FOOD, '50.5'),
        income(CZK_2, SALARY, '5000'),
        expense(CZK_1, null, '30'),
        expense(EUR_1, FOOD, '10'),
      ])
      findAccounts.mockResolvedValue([
        { id: CZK_1, currency: 'CZK' },
        { id: CZK_2, currency: 'CZK' },
        { id: EUR_1, currency: 'EUR' },
      ])
      findCategories.mockResolvedValue([
        { id: FOOD, name: 'Food' },
        { id: SALARY, name: 'Salary' },
      ])

      const rows = await service.categoryTotals(OWNER, RANGE)

      expect(lines(rows)).toStrictEqual([
        'CZK|Food|0.0000|150.5000',
        'CZK|Salary|5000.0000|0.0000',
        'CZK|-|0.0000|30.0000',
        'EUR|Food|0.0000|10.0000',
      ])
      expect(rows[0]?.category).toStrictEqual({ id: FOOD, name: 'Food' })
      expect(rows[2]?.category).toBeNull()
    })

    it('are the same whatever order the database returned the sums in', async () => {
      const groups = [expense(CZK_1, FOOD, '1'), income(CZK_1, SALARY, '2'), expense(EUR_1, null, '3')]
      findAccounts.mockResolvedValue([
        { id: CZK_1, currency: 'CZK' },
        { id: EUR_1, currency: 'EUR' },
      ])
      findCategories.mockResolvedValue([
        { id: FOOD, name: 'Food' },
        { id: SALARY, name: 'Salary' },
      ])
      groupBy.mockResolvedValue(groups)
      const forward = await service.categoryTotals(OWNER, RANGE)

      groupBy.mockResolvedValue(groups.toReversed())
      const backward = await service.categoryTotals(OWNER, RANGE)

      expect(lines(backward)).toStrictEqual(lines(forward))
    })
  })

  describe('a broken invariant', () => {
    it('fails for a sum of an account the owner does not have, instead of guessing its currency', async () => {
      groupBy.mockResolvedValue([expense(CZK_1, null, '1')])

      await expect(service.categoryTotals(OWNER, RANGE)).rejects.toThrow(
        'A group of transactions belongs to an account that was not read',
      )
    })

    it('fails for a sum of a category the owner does not have, and never names it', async () => {
      groupBy.mockResolvedValue([expense(CZK_1, FOREIGN_CATEGORY, '1')])
      findAccounts.mockResolvedValue([{ id: CZK_1, currency: 'CZK' }])
      // The scoped read does not find a category of somebody else, whatever its name.
      findCategories.mockResolvedValue([])

      const failure = service.categoryTotals(OWNER, RANGE)

      await expect(failure).rejects.toThrow('A group of transactions belongs to a category that was not read')
      await expect(failure).rejects.not.toThrow(FOREIGN_CATEGORY)
    })
  })
})
