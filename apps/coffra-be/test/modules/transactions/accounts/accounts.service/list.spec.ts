import { describe, expect, it } from 'vitest'

import { Prisma } from '../../../../../src/modules/prisma'

import { OWNER, row, useAccountsService, VIEW } from './setup'

describe('AccountsService.list', () => {
  const { service, findMany } = useAccountsService()

  it('asks only for the rows of the owner, with nothing else in the filter', async () => {
    findMany.mockResolvedValue([])

    await service.list(OWNER)

    expect(findMany).toHaveBeenCalledOnce()
    expect((findMany.mock.calls[0]?.[0] as { where: unknown }).where).toStrictEqual({ userId: OWNER.userId })
  })

  it('orders by name, then by id, so accounts with the same name keep their place', async () => {
    findMany.mockResolvedValue([])

    await service.list(OWNER)

    expect((findMany.mock.calls[0]?.[0] as { orderBy: unknown }).orderBy).toStrictEqual([
      { name: 'asc' },
      { id: 'asc' },
    ])
  })

  it('maps every row to the view, in the order the database returned them', async () => {
    const second = row({
      id: '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e',
      name: 'Wallet',
      type: 'cash',
      openingBalance: new Prisma.Decimal('-20'),
    })
    findMany.mockResolvedValue([row(), second])

    expect(await service.list(OWNER)).toStrictEqual([
      VIEW,
      { id: second.id, name: 'Wallet', type: 'cash', currency: 'CZK', openingBalance: '-20.0000' },
    ])
  })

  it('returns an empty list for an owner without accounts', async () => {
    findMany.mockResolvedValue([])

    expect(await service.list(OWNER)).toEqual([])
  })
})
