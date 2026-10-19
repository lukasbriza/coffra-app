import { ConflictException, UnauthorizedException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { OWNER, prismaError, row, useCategoriesService, VIEW } from './setup'

describe('CategoriesService.create', () => {
  const { service, create } = useCategoriesService()

  it('writes the name and the owner from the ownership layer, nothing else', async () => {
    create.mockResolvedValue(row())

    await service.create(OWNER, { name: 'Food' })

    expect(create).toHaveBeenCalledExactlyOnceWith({ data: { name: 'Food', userId: OWNER.userId } })
  })

  it('never writes tenantId', async () => {
    create.mockResolvedValue(row())

    await service.create(OWNER, { name: 'Food' })

    expect((create.mock.calls[0]?.[0] as { data: object }).data).not.toHaveProperty('tenantId')
  })

  it('stores the name with its case as it is: food stays food, a category of its own next to Food', async () => {
    create.mockResolvedValue(row({ name: 'food' }))

    await service.create(OWNER, { name: 'food' })

    expect((create.mock.calls[0]?.[0] as { data: { name: string } }).data.name).toBe('food')
  })

  it('returns the view of the created row', async () => {
    create.mockResolvedValue(row())

    await expect(service.create(OWNER, { name: 'Food' })).resolves.toStrictEqual(VIEW)
  })

  it('answers 409 when the owner already has a category with the name (the unique constraint)', async () => {
    create.mockRejectedValue(prismaError('P2002'))

    const error = await service.create(OWNER, { name: 'Food' }).catch((error_: unknown) => error_)

    expect(error).toBeInstanceOf(ConflictException)
    expect((error as ConflictException).message).toBe('Category with this name already exists')
  })

  it('answers 401 when the owner no longer exists (foreign key to the user)', async () => {
    create.mockRejectedValue(prismaError('P2003'))

    const error = await service.create(OWNER, { name: 'Food' }).catch((error_: unknown) => error_)

    expect(error).toBeInstanceOf(UnauthorizedException)
    expect((error as UnauthorizedException).message).toBe('Invalid or expired access token')
  })

  it('passes any other error on unchanged', async () => {
    const gone = prismaError('P2025')
    const plain = new Error('connection lost')

    create.mockRejectedValueOnce(gone).mockRejectedValueOnce(plain)

    await expect(service.create(OWNER, { name: 'Food' })).rejects.toBe(gone)
    await expect(service.create(OWNER, { name: 'Food' })).rejects.toBe(plain)
  })
})
