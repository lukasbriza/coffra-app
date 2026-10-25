import { describe, expect, it } from 'vitest'

import { OWNER, row, useCategoriesService, VIEW } from './setup'

describe('CategoriesService.list', () => {
  const { service, findMany } = useCategoriesService()

  it('asks only for the rows of the owner, with nothing else in the filter', async () => {
    findMany.mockResolvedValue([])

    await service.list(OWNER)

    expect(findMany).toHaveBeenCalledOnce()
    expect((findMany.mock.calls[0]?.[0] as { where: unknown }).where).toStrictEqual({ userId: OWNER.userId })
  })

  it('orders by name, then by id', async () => {
    findMany.mockResolvedValue([])

    await service.list(OWNER)

    expect((findMany.mock.calls[0]?.[0] as { orderBy: unknown }).orderBy).toStrictEqual([
      { name: 'asc' },
      { id: 'asc' },
    ])
  })

  it('maps every row to the view, in the order the database returned them', async () => {
    const second = row({ id: '4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f7a', name: 'food' })
    findMany.mockResolvedValue([row(), second])

    await expect(service.list(OWNER)).resolves.toStrictEqual([VIEW, { id: second.id, name: 'food' }])
  })

  it('returns an empty list for an owner without categories', async () => {
    findMany.mockResolvedValue([])

    await expect(service.list(OWNER)).resolves.toEqual([])
  })
})
