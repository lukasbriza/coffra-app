import { ConflictException, NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { CATEGORY_ID, OWNER, useCategoriesController, VIEW } from './setup'

const PATH = `/api/categories/${CATEGORY_ID}`

type ErrorBody = { message: string[] | string }

describe('PATCH /api/categories/:id', () => {
  const { categories, send, anonymous, calls } = useCategoriesController()

  it('answers 200 with the renamed category', async () => {
    const response = await send('patch', PATH, { name: 'Groceries' }).expect(200)

    expect(response.body).toStrictEqual(VIEW)
    expect(categories.update).toHaveBeenCalledExactlyOnceWith(OWNER, CATEGORY_ID, { name: 'Groceries' })
  })

  it('trims the new name and keeps its case', async () => {
    await send('patch', PATH, { name: ' food  ' }).expect(200)

    expect(categories.update.mock.calls[0]?.[2]).toEqual({ name: 'food' })
  })

  it('takes an empty body as no change', async () => {
    await send('patch', PATH, {}).expect(200)

    expect(categories.update.mock.calls[0]?.[2]).toEqual({})
  })

  it.each([
    ['a null name', { name: null }],
    ['an empty name', { name: '' }],
    ['a blank name', { name: '  ' }],
    ['a name of 101 characters', { name: 'a'.repeat(101) }],
    ['a name that is a number', { name: 42 }],
  ])('answers 400 for %s, before the service runs', async (_name, body) => {
    await send('patch', PATH, body).expect(400)

    expect(calls()).toBe(0)
  })

  it('answers 400 for an id that is not a UUID', async () => {
    await send('patch', '/api/categories/abc', { name: 'Groceries' }).expect(400)

    expect(calls()).toBe(0)
  })

  it('passes the 409 of a duplicate name through unchanged', async () => {
    categories.update.mockRejectedValue(new ConflictException('Category with this name already exists'))

    const response = await send('patch', PATH, { name: 'Food' }).expect(409)

    expect((response.body as ErrorBody).message).toBe('Category with this name already exists')
  })

  it('passes the 404 of a missing or foreign category through unchanged', async () => {
    categories.update.mockRejectedValue(new NotFoundException('Category not found'))

    const response = await send('patch', PATH, { name: 'Groceries' }).expect(404)

    expect((response.body as ErrorBody).message).toBe('Category not found')
  })

  it('answers 401 without a token and does not run the service', async () => {
    await anonymous('patch', PATH).send({ name: 'Groceries' }).expect(401)

    expect(calls()).toBe(0)
  })
})
