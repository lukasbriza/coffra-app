import { NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { CATEGORY_ID, OWNER, useCategoriesController, VIEW } from './setup'

describe('GET /api/categories/:id', () => {
  const { categories, send, anonymous, calls } = useCategoriesController()

  it('answers 200 with the category', async () => {
    const response = await send('get', `/api/categories/${CATEGORY_ID}`).expect(200)

    expect(response.body).toStrictEqual(VIEW)
    expect(categories.findOne).toHaveBeenCalledExactlyOnceWith(OWNER, CATEGORY_ID)
  })

  it.each(['abc', '123', `${CATEGORY_ID}0`, CATEGORY_ID.replaceAll('-', '')])(
    'answers 400 for the id %j, before the service runs',
    async (id) => {
      const response = await send('get', `/api/categories/${id}`).expect(400)

      expect((response.body as { message: string }).message).toBe('Validation failed (uuid is expected)')
      expect(calls()).toBe(0)
    },
  )

  it('passes the 404 of a missing or foreign category through unchanged', async () => {
    categories.findOne.mockRejectedValue(new NotFoundException('Category not found'))

    const response = await send('get', `/api/categories/${CATEGORY_ID}`).expect(404)

    expect(response.body).toStrictEqual({ statusCode: 404, message: 'Category not found', error: 'Not Found' })
  })

  it('answers 401 without a token, before the id is checked', async () => {
    await anonymous('get', '/api/categories/abc').expect(401)

    expect(calls()).toBe(0)
  })
})
