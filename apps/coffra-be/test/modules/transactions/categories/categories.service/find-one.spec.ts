import { NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { CATEGORY_ID, OWNED, OWNER, useCategoriesService, VIEW } from './setup'

describe('CategoriesService.findOne', () => {
  const { service, findFirst } = useCategoriesService()

  it('looks the category up by its id within the rows of the owner', async () => {
    await service.findOne(OWNER, CATEGORY_ID)

    expect(findFirst).toHaveBeenCalledExactlyOnceWith({ where: OWNED })
  })

  it('returns the view of the category', async () => {
    await expect(service.findOne(OWNER, CATEGORY_ID)).resolves.toStrictEqual(VIEW)
  })

  it('answers 404 Category not found when the scoped query finds nothing (missing or foreign)', async () => {
    findFirst.mockResolvedValue(null)

    const error = await service.findOne(OWNER, CATEGORY_ID).catch((error_: unknown) => error_)

    expect(error).toBeInstanceOf(NotFoundException)
    expect((error as NotFoundException).getResponse()).toStrictEqual({
      statusCode: 404,
      message: 'Category not found',
      error: 'Not Found',
    })
  })
})
