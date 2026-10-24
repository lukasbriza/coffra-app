import { ConflictException, NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { CATEGORY_ID, OWNED, OWNER, prismaError, row, useCategoriesService } from './setup'

describe('CategoriesService.update', () => {
  const { service, findFirst, update } = useCategoriesService()

  it('finds the category within the rows of the owner first, then writes with the same scope', async () => {
    update.mockResolvedValue(row({ name: 'Groceries' }))

    await service.update(OWNER, CATEGORY_ID, { name: 'Groceries' })

    expect(findFirst).toHaveBeenCalledExactlyOnceWith({ where: OWNED })
    expect(update).toHaveBeenCalledExactlyOnceWith({ where: OWNED, data: { name: 'Groceries' } })
  })

  it('writes nothing but the timestamp for an empty input', async () => {
    update.mockResolvedValue(row())

    await service.update(OWNER, CATEGORY_ID, {})

    expect((update.mock.calls[0]?.[0] as { data: unknown }).data).toStrictEqual({})
  })

  it('returns the view of the renamed row', async () => {
    update.mockResolvedValue(row({ name: 'Groceries' }))

    await expect(service.update(OWNER, CATEGORY_ID, { name: 'Groceries' })).resolves.toStrictEqual({
      id: CATEGORY_ID,
      name: 'Groceries',
    })
  })

  it('answers 404 without writing when the scoped query finds nothing (missing or foreign)', async () => {
    findFirst.mockResolvedValue(null)

    await expect(service.update(OWNER, CATEGORY_ID, { name: 'Groceries' })).rejects.toThrow(NotFoundException)
    expect(update).not.toHaveBeenCalled()
  })

  it('answers 409 when another category of the owner has the name (the unique constraint)', async () => {
    update.mockRejectedValue(prismaError('P2002'))

    const error = await service.update(OWNER, CATEGORY_ID, { name: 'Food' }).catch((error_: unknown) => error_)

    expect(error).toBeInstanceOf(ConflictException)
    expect((error as ConflictException).message).toBe('Category with this name already exists')
  })

  it('answers the same 404 when the category was deleted between the read and the write', async () => {
    update.mockRejectedValue(prismaError('P2025'))

    const error = await service.update(OWNER, CATEGORY_ID, { name: 'Groceries' }).catch((error_: unknown) => error_)

    expect(error).toBeInstanceOf(NotFoundException)
    expect((error as NotFoundException).message).toBe('Category not found')
  })

  it('passes any other error on unchanged', async () => {
    const failure = prismaError('P2003')
    update.mockRejectedValue(failure)

    await expect(service.update(OWNER, CATEGORY_ID, { name: 'Groceries' })).rejects.toBe(failure)
  })
})
