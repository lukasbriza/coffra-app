import { ConflictException, NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { CATEGORY_ID, OWNED, OWNER, prismaError, row, useCategoriesService } from './setup'

describe('CategoriesService.remove', () => {
  const { service, findFirst, remove } = useCategoriesService()

  it('finds the category within the rows of the owner first, then deletes with the same scope', async () => {
    remove.mockResolvedValue(row())

    await expect(service.remove(OWNER, CATEGORY_ID)).resolves.toBeUndefined()

    expect(findFirst).toHaveBeenCalledExactlyOnceWith({ where: OWNED })
    expect(remove).toHaveBeenCalledExactlyOnceWith({ where: OWNED })
  })

  it('answers 404 without deleting when the scoped query finds nothing (missing or foreign)', async () => {
    findFirst.mockResolvedValue(null)

    await expect(service.remove(OWNER, CATEGORY_ID)).rejects.toThrow(NotFoundException)
    expect(remove).not.toHaveBeenCalled()
  })

  it('answers 409 when the category still has transactions (the Restrict of the database)', async () => {
    remove.mockRejectedValue(prismaError('P2003'))

    const error = await service.remove(OWNER, CATEGORY_ID).catch((error_: unknown) => error_)

    expect(error).toBeInstanceOf(ConflictException)
    expect((error as ConflictException).message).toBe('Category has transactions and cannot be deleted')
  })

  it('answers the same 404 when the category was deleted between the read and the delete', async () => {
    remove.mockRejectedValue(prismaError('P2025'))

    const error = await service.remove(OWNER, CATEGORY_ID).catch((error_: unknown) => error_)

    expect(error).toBeInstanceOf(NotFoundException)
    expect((error as NotFoundException).message).toBe('Category not found')
  })

  it('passes any other error on unchanged', async () => {
    const failure = new Error('connection lost')
    remove.mockRejectedValue(failure)

    await expect(service.remove(OWNER, CATEGORY_ID)).rejects.toBe(failure)
  })
})
