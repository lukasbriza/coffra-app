import { describe, expect, it } from 'vitest'

import { OWNER, useCategoriesController, VIEW } from './setup'

describe('GET /api/categories', () => {
  const { categories, send, anonymous, calls } = useCategoriesController()

  it('answers 200 with the categories of the owner of the token', async () => {
    const response = await send('get', '/api/categories').expect(200)

    expect(response.body).toStrictEqual([VIEW])
    expect(categories.list).toHaveBeenCalledExactlyOnceWith(OWNER)
  })

  it('answers an empty list as []', async () => {
    categories.list.mockResolvedValue([])

    await send('get', '/api/categories').expect(200, [])
  })

  it('answers 401 without a token and does not run the service', async () => {
    await anonymous('get', '/api/categories').expect(401)

    expect(calls()).toBe(0)
  })
})
