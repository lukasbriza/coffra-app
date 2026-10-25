import { randomUUID } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { balancesOf, conflict, seededBalances } from '../support/responses'
import { useIntegrationApp } from '../support/use-integration-app'
import { idsOf, ownIds } from '../support/world'

describe('isolation of accounts', () => {
  const { as, anonymous, world, prisma, unchanged, expectNotFound } = useIntegrationApp()

  it('turns a request without a token away', async () => {
    await anonymous().get('/api/accounts').expect(401)
  })

  describe('GET /api/accounts', () => {
    it('lists only the accounts of the caller, with balances from their own transactions', async () => {
      const { a } = world()

      const response = await as(a).get('/api/accounts').expect(200)

      expect(idsOf(response.body)).toStrictEqual(ownIds(a.accounts))
      expect(balancesOf(response.body)).toStrictEqual(seededBalances(a))
    })

    it('lists only the accounts of the other user for them (control)', async () => {
      const { b } = world()

      const response = await as(b).get('/api/accounts').expect(200)

      expect(idsOf(response.body)).toStrictEqual(ownIds(b.accounts))
      expect(balancesOf(response.body)).toStrictEqual(seededBalances(b))
    })

    it('lists only the accounts of the caller as of a past day too', async () => {
      const { a } = world()

      // Between the income and the expense: only the income counts, on top of the opening balances.
      const response = await as(a).get('/api/accounts?asOf=2026-01-11').expect(200)

      expect(balancesOf(response.body)).toStrictEqual({
        [a.accounts.main]: '3500.0000',
        [a.accounts.savings]: '0.0000',
        [a.accounts.euro]: '50.0000',
        [a.accounts.empty]: '42.0000',
      })
    })
  })

  describe('GET /api/accounts/:id', () => {
    it('answers 404 for an account of another user, the same as for an id nobody has', async () => {
      const { a, b } = world()

      await expectNotFound((id) => as(a).get(`/api/accounts/${id}`), b.accounts.main, 'Account not found')
    })

    it('answers the same 404 with asOf', async () => {
      const { a, b } = world()

      await expectNotFound(
        (id) => as(a).get(`/api/accounts/${id}?asOf=2026-01-11`),
        b.accounts.main,
        'Account not found',
      )
    })

    it('returns an own account with its balance (control)', async () => {
      const { a } = world()

      const response = await as(a).get(`/api/accounts/${a.accounts.main}`).expect(200)

      expect(response.body).toMatchObject({ id: a.accounts.main, balance: a.balances.main })
    })
  })

  describe('PATCH /api/accounts/:id', () => {
    it('answers 404 for an account of another user and changes nothing', async () => {
      const { a, b } = world()

      await expectNotFound(
        (id) => as(a).patch(`/api/accounts/${id}`, { name: 'Taken over', openingBalance: '0' }),
        b.accounts.main,
        'Account not found',
      )
    })

    it('changes an own account (control)', async () => {
      const { a } = world()

      const response = await as(a).patch(`/api/accounts/${a.accounts.main}`, { name: 'Renamed' }).expect(200)

      expect(response.body).toMatchObject({ id: a.accounts.main, name: 'Renamed' })
    })
  })

  describe('DELETE /api/accounts/:id', () => {
    it('answers 404 for an account of another user with transactions, not the 409 its owner gets', async () => {
      const { a, b } = world()

      await expectNotFound((id) => as(a).delete(`/api/accounts/${id}`), b.accounts.main, 'Account not found')
    })

    it('answers 404 for an account of another user without transactions, not 204, and keeps it', async () => {
      const { a, b } = world()

      await expectNotFound((id) => as(a).delete(`/api/accounts/${id}`), b.accounts.empty, 'Account not found')
    })

    it('refuses to delete an own account with transactions (control)', async () => {
      const { a } = world()

      const response = await unchanged(() => as(a).delete(`/api/accounts/${a.accounts.main}`).expect(409))

      expect(response.body).toStrictEqual(conflict('Account has transactions and cannot be deleted'))
    })

    it('deletes an own account without transactions (control)', async () => {
      const { a } = world()

      await as(a).delete(`/api/accounts/${a.accounts.empty}`).expect(204)

      expect(await prisma().account.count({ where: { id: a.accounts.empty } })).toBe(0)
    })
  })

  describe('POST /api/accounts', () => {
    it('creates the account for the caller, whatever owner the body names', async () => {
      const { a, b } = world()

      const response = await as(a)
        .post('/api/accounts', {
          name: 'Pocket',
          type: 'cash',
          currency: 'CZK',
          userId: b.userId,
          tenantId: randomUUID(),
        })
        .expect(201)
      const id = (response.body as { id: string }).id

      expect(await prisma().account.findUniqueOrThrow({ where: { id } })).toMatchObject({
        userId: a.userId,
        tenantId: null,
      })
      const listOfA = await as(a).get('/api/accounts').expect(200)
      const listOfB = await as(b).get('/api/accounts').expect(200)

      expect(idsOf(listOfA.body)).toContain(id)
      expect(idsOf(listOfB.body)).toStrictEqual(ownIds(b.accounts))
    })
  })
})
