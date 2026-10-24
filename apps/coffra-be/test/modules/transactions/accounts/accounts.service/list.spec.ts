import { describe, expect, it, vi } from 'vitest'

import { Prisma, TransactionType, TransferDirection } from '../../../../../src/modules/prisma'
import { TIME_ZONES, useTimeZone } from '../../../../utils/use-time-zone'

import { ACCOUNT_ID, expense, group, income, OWNER, row, TODAY, totalsQuery, useAccountsService, VIEW } from './setup'

const SECOND_ID = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e'
const THIRD_ID = '7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f'

describe('AccountsService.list', () => {
  const { service, findMany, groupBy } = useAccountsService()

  it('asks only for the rows of the owner, with nothing else in the filter', async () => {
    findMany.mockResolvedValue([])

    await service.list(OWNER, {})

    expect(findMany).toHaveBeenCalledOnce()
    expect((findMany.mock.calls[0]?.[0] as { where: unknown }).where).toStrictEqual({ userId: OWNER.userId })
  })

  it('orders by name, then by id, so accounts with the same name keep their place', async () => {
    findMany.mockResolvedValue([])

    await service.list(OWNER, {})

    expect((findMany.mock.calls[0]?.[0] as { orderBy: unknown }).orderBy).toStrictEqual([
      { name: 'asc' },
      { id: 'asc' },
    ])
  })

  it('maps every row to the view with its balance, in the order the database returned them', async () => {
    const second = row({
      id: SECOND_ID,
      name: 'Wallet',
      type: 'cash',
      openingBalance: new Prisma.Decimal('-20'),
    })
    findMany.mockResolvedValue([row(), second])
    groupBy.mockResolvedValue([income('500', ACCOUNT_ID), expense('200.25', ACCOUNT_ID)])

    await expect(service.list(OWNER, {})).resolves.toStrictEqual([
      { ...VIEW, balance: '1550.2500' },
      { id: SECOND_ID, name: 'Wallet', type: 'cash', currency: 'CZK', openingBalance: '-20.0000', balance: '-20.0000' },
    ])
  })

  it('returns an empty list for an owner without accounts, and does not aggregate', async () => {
    findMany.mockResolvedValue([])

    await expect(service.list(OWNER, {})).resolves.toEqual([])
    expect(groupBy).not.toHaveBeenCalled()
  })

  describe('the aggregation', () => {
    it('is one query for the accounts read, whatever their number', async () => {
      findMany.mockResolvedValue([row()])
      await service.list(OWNER, {})
      expect(groupBy).toHaveBeenCalledTimes(1)

      groupBy.mockClear()
      findMany.mockResolvedValue([row(), row({ id: SECOND_ID }), row({ id: THIRD_ID })])
      await service.list(OWNER, {})
      expect(groupBy).toHaveBeenCalledTimes(1)
    })

    it('asks for exactly the accounts it read, within the owner scope, up to the end of today (UTC)', async () => {
      findMany.mockResolvedValue([row(), row({ id: SECOND_ID }), row({ id: THIRD_ID })])

      await service.list(OWNER, {})

      expect(groupBy).toHaveBeenCalledExactlyOnceWith(totalsQuery([ACCOUNT_ID, SECOND_ID, THIRD_ID], TODAY))
    })

    it('counts up to the day asked for, inclusive, as midnight UTC of that day', async () => {
      findMany.mockResolvedValue([row()])

      await service.list(OWNER, { asOf: '2026-12-31' })

      expect(groupBy).toHaveBeenCalledExactlyOnceWith(totalsQuery([ACCOUNT_ID], new Date('2026-12-31T00:00:00.000Z')))
    })

    it('gives every sum to the account it belongs to, whatever the order of the groups', async () => {
      findMany.mockResolvedValue([row(), row({ id: SECOND_ID, openingBalance: new Prisma.Decimal(0) })])
      groupBy.mockResolvedValue([
        income('50', SECOND_ID),
        group(TransactionType.transfer, '300', TransferDirection.out, ACCOUNT_ID),
        expense('10', SECOND_ID),
        group(TransactionType.transfer, '300', TransferDirection.in, SECOND_ID),
        income('1000', ACCOUNT_ID),
      ])

      const views = await service.list(OWNER, {})

      // 1250.5 - 300 + 1000, and 0 + 50 - 10 + 300
      expect(views.map(({ balance }) => balance)).toEqual(['1950.5000', '340.0000'])
    })

    it('does not mistake a group of an account that was not read for one of the list', async () => {
      findMany.mockResolvedValue([row()])
      groupBy.mockResolvedValue([income('999', SECOND_ID)])

      const [view] = await service.list(OWNER, {})

      expect(view.balance).toBe('1250.5000')
    })

    it('fails on a null sum: a group has at least one row and the amount is never null', async () => {
      findMany.mockResolvedValue([row()])
      groupBy.mockResolvedValue([{ ...income('1'), _sum: { amount: null } }])

      await expect(service.list(OWNER, {})).rejects.toThrow('The sum of a group of transactions is null')
    })

    it('passes a failure of the aggregation on unchanged', async () => {
      const failure = new Error('connection lost')
      findMany.mockResolvedValue([row()])
      groupBy.mockRejectedValue(failure)

      await expect(service.list(OWNER, {})).rejects.toBe(failure)
    })
  })

  describe('today', () => {
    // 23:30 UTC on the 22nd is already the 23rd in Pacific/Kiritimati and still the 22nd in Pacific/Pago_Pago.
    describe.each(TIME_ZONES)('on a server in the time zone %s', (zone, offset) => {
      useTimeZone(zone, offset)

      it.each([
        ['2026-10-22T00:00:00.000Z', '2026-10-22T00:00:00.000Z'],
        ['2026-10-22T23:59:59.999Z', '2026-10-22T00:00:00.000Z'],
        ['2026-10-23T00:00:00.000Z', '2026-10-23T00:00:00.000Z'],
        ['2026-12-31T23:30:00.000Z', '2026-12-31T00:00:00.000Z'],
      ])('at %s the bound is the UTC day %s', async (now, bound) => {
        vi.setSystemTime(new Date(now))
        findMany.mockResolvedValue([row()])

        await service.list(OWNER, {})

        const { where } = groupBy.mock.calls[0]?.[0] as { where: { date: { lte: Date } } }
        expect(where.date.lte.toISOString()).toBe(bound)
      })

      it('bounds a day asked for at the same instant as on a server in UTC', async () => {
        findMany.mockResolvedValue([row()])

        await service.list(OWNER, { asOf: '2026-10-22' })

        const { where } = groupBy.mock.calls[0]?.[0] as { where: { date: { lte: Date } } }
        expect(where.date.lte.toISOString()).toBe('2026-10-22T00:00:00.000Z')
      })
    })
  })
})
