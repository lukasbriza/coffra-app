import { ConflictException, UnauthorizedException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'

import { OWNER, useCategoriesController, VIEW } from './setup'

type ErrorBody = { statusCode: number; message: string[] | string }

describe('POST /api/categories', () => {
  const { categories, send, anonymous, calls } = useCategoriesController()

  it('answers 201 with the created category', async () => {
    const response = await send('post', '/api/categories', { name: 'Food' }).expect(201)

    expect(response.body).toStrictEqual(VIEW)
  })

  it('creates the category for the owner of the token, with the name of the body', async () => {
    await send('post', '/api/categories', { name: 'Food' }).expect(201)

    expect(categories.create).toHaveBeenCalledExactlyOnceWith(OWNER, { name: 'Food' })
  })

  it('never lets the body choose the owner or anything else outside the name', async () => {
    const foreign = '7d1c2b9a-5e4f-4a3b-8c2d-1e0f9a8b7c62'

    await send('post', '/api/categories', { name: 'Food', userId: foreign, tenantId: foreign, id: foreign }).expect(201)

    const [owner, input] = categories.create.mock.calls[0] ?? []
    expect(owner).toStrictEqual(OWNER)
    expect({ ...input }).toStrictEqual({ name: 'Food' }) // own properties of the DTO instance, nothing but the name
  })

  it('trims the name', async () => {
    await send('post', '/api/categories', { name: '  Food ' }).expect(201)

    expect(categories.create.mock.calls[0]?.[1].name).toBe('Food')
  })

  it('keeps the case of the name: Food and food reach the service as two different names', async () => {
    await send('post', '/api/categories', { name: 'Food' }).expect(201)
    await send('post', '/api/categories', { name: 'food' }).expect(201)

    expect(categories.create.mock.calls.map(([, input]) => input.name)).toEqual(['Food', 'food'])
  })

  it.each([
    ['no name', {}],
    ['an empty name', { name: '' }],
    ['a blank name', { name: ' '.repeat(3) }],
    ['a name of 101 characters', { name: 'a'.repeat(101) }],
    ['a name that is a number', { name: 42 }],
    ['a null name', { name: null }],
  ])('answers 400 for %s, before the service runs', async (_name, body) => {
    const response = await send('post', '/api/categories', body).expect(400)

    expect((response.body as ErrorBody).statusCode).toBe(400)
    expect(calls()).toBe(0)
  })

  it('accepts a name of 100 characters', async () => {
    await send('post', '/api/categories', { name: 'a'.repeat(100) }).expect(201)
  })

  it('passes the 409 of a duplicate name through unchanged', async () => {
    categories.create.mockRejectedValue(new ConflictException('Category with this name already exists'))

    const response = await send('post', '/api/categories', { name: 'Food' }).expect(409)

    expect(response.body).toStrictEqual({
      statusCode: 409,
      message: 'Category with this name already exists',
      error: 'Conflict',
    })
  })

  it('passes the 401 of a deleted owner through', async () => {
    categories.create.mockRejectedValue(new UnauthorizedException('Invalid or expired access token'))

    const response = await send('post', '/api/categories', { name: 'Food' }).expect(401)

    expect((response.body as ErrorBody).message).toBe('Invalid or expired access token')
  })

  it('answers 401 without a token and does not run the service', async () => {
    await anonymous('post', '/api/categories').send({ name: 'Food' }).expect(401)

    expect(calls()).toBe(0)
  })
})
