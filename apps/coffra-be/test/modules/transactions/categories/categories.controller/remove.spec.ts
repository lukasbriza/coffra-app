import { ConflictException, NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { CATEGORY_ID, OWNER, useCategoriesController } from './setup'

const PATH = `/api/categories/${CATEGORY_ID}`

describe('DELETE /api/categories/:id', () => {
  const { categories, send, anonymous, calls } = useCategoriesController()

  it('answers 204 with an empty body', async () => {
    const response = await send('delete', PATH).expect(204)

    expect(response.text).toBe('')
    expect(categories.remove).toHaveBeenCalledExactlyOnceWith(OWNER, CATEGORY_ID)
  })

  it('passes the 409 of a category with transactions through unchanged', async () => {
    categories.remove.mockRejectedValue(new ConflictException('Category has transactions and cannot be deleted'))

    const response = await send('delete', PATH).expect(409)

    expect(response.body).toStrictEqual({
      statusCode: 409,
      message: 'Category has transactions and cannot be deleted',
      error: 'Conflict',
    })
  })

  it('passes the 404 of a missing or foreign category through unchanged', async () => {
    categories.remove.mockRejectedValue(new NotFoundException('Category not found'))

    await send('delete', PATH).expect(404)
  })

  it('answers 400 for an id that is not a UUID', async () => {
    await send('delete', '/api/categories/abc').expect(400)

    expect(calls()).toBe(0)
  })

  it('answers 401 without a token and does not run the service', async () => {
    await anonymous('delete', PATH).expect(401)

    expect(calls()).toBe(0)
  })
})
