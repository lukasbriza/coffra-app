import { describe, expect, it } from 'vitest'

import { conflict } from '../support/responses'
import { useIntegrationApp } from '../support/use-integration-app'
import { idsOf, ownIds } from '../support/world'

describe('isolation of categories', () => {
  const { as, anonymous, world, prisma, unchanged, expectNotFound } = useIntegrationApp()

  it('turns a request without a token away', async () => {
    await anonymous().get('/api/categories').expect(401)
  })

  describe('GET /api/categories', () => {
    it('lists only the categories of the caller, although both users have the same names', async () => {
      const { a } = world()

      const response = await as(a).get('/api/categories').expect(200)

      expect(idsOf(response.body)).toStrictEqual(ownIds(a.categories))
    })

    it('lists only the categories of the other user for them (control)', async () => {
      const { b } = world()

      const response = await as(b).get('/api/categories').expect(200)

      expect(idsOf(response.body)).toStrictEqual(ownIds(b.categories))
    })
  })

  describe('GET /api/categories/:id', () => {
    it('answers 404 for a category of another user, the same as for an id nobody has', async () => {
      const { a, b } = world()

      await expectNotFound((id) => as(a).get(`/api/categories/${id}`), b.categories.food, 'Category not found')
    })

    it('returns an own category (control)', async () => {
      const { a } = world()

      const response = await as(a).get(`/api/categories/${a.categories.food}`).expect(200)

      expect(response.body).toStrictEqual({ id: a.categories.food, name: 'Food' })
    })
  })

  describe('PATCH /api/categories/:id', () => {
    it('answers 404 for a category of another user and changes nothing', async () => {
      const { a, b } = world()

      await expectNotFound(
        (id) => as(a).patch(`/api/categories/${id}`, { name: 'Taken over' }),
        b.categories.food,
        'Category not found',
      )
    })

    it('renames an own category to a name only the other user has, not a 409', async () => {
      const { a, b } = world()
      await as(b).post('/api/categories', { name: 'Travel' }).expect(201)

      const response = await as(a).patch(`/api/categories/${a.categories.unused}`, { name: 'Travel' }).expect(200)

      expect(response.body).toStrictEqual({ id: a.categories.unused, name: 'Travel' })
    })

    it('refuses to rename an own category to a name the caller already has (control)', async () => {
      const { a } = world()

      const response = await unchanged(() =>
        as(a).patch(`/api/categories/${a.categories.unused}`, { name: 'Food' }).expect(409),
      )

      expect(response.body).toStrictEqual(conflict('Category with this name already exists'))
    })
  })

  describe('DELETE /api/categories/:id', () => {
    it('answers 404 for a category of another user with transactions, not the 409 its owner gets', async () => {
      const { a, b } = world()

      await expectNotFound((id) => as(a).delete(`/api/categories/${id}`), b.categories.food, 'Category not found')
    })

    it('answers 404 for a category of another user without transactions, not 204, and keeps it', async () => {
      const { a, b } = world()

      await expectNotFound((id) => as(a).delete(`/api/categories/${id}`), b.categories.unused, 'Category not found')
    })

    it('refuses to delete an own category with transactions (control)', async () => {
      const { a } = world()

      const response = await unchanged(() => as(a).delete(`/api/categories/${a.categories.food}`).expect(409))

      expect(response.body).toStrictEqual(conflict('Category has transactions and cannot be deleted'))
    })

    it('deletes an own category without transactions (control)', async () => {
      const { a } = world()

      await as(a).delete(`/api/categories/${a.categories.unused}`).expect(204)

      expect(await prisma().category.count({ where: { id: a.categories.unused } })).toBe(0)
    })
  })

  describe('POST /api/categories', () => {
    it('creates a category with a name only the other user has, not a 409', async () => {
      const { a, b } = world()
      await as(b).post('/api/categories', { name: 'Travel' }).expect(201)

      const response = await as(a).post('/api/categories', { name: 'Travel' }).expect(201)
      const id = (response.body as { id: string }).id

      expect(await prisma().category.findUniqueOrThrow({ where: { id } })).toMatchObject({ userId: a.userId })
    })

    it('creates the category for the caller, whatever owner the body names', async () => {
      const { a, b } = world()

      const response = await as(a).post('/api/categories', { name: 'Travel', userId: b.userId }).expect(201)
      const id = (response.body as { id: string }).id

      const listOfB = await as(b).get('/api/categories').expect(200)

      expect(await prisma().category.findUniqueOrThrow({ where: { id } })).toMatchObject({ userId: a.userId })
      expect(idsOf(listOfB.body)).toStrictEqual(ownIds(b.categories))
    })

    it('refuses a name the caller already has (control)', async () => {
      const { a } = world()

      const response = await unchanged(() => as(a).post('/api/categories', { name: 'Food' }).expect(409))

      expect(response.body).toStrictEqual(conflict('Category with this name already exists'))
    })
  })
})
