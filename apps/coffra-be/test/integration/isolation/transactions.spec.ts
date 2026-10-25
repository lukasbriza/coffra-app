import { describe, expect, it } from 'vitest'

import { conflict } from '../support/responses'
import { useIntegrationApp } from '../support/use-integration-app'
import type { Persona } from '../support/world'

/**
 * A valid body of an expense.
 *
 * @param accountId - the account of the expense
 * @param categoryId - its category, if any
 * @returns the body of `POST /api/transactions`
 */
const expense = (accountId: string, categoryId?: string): Record<string, string> => ({
  accountId,
  type: 'expense',
  amount: '10',
  date: '2026-02-01',
  ...(categoryId === undefined ? {} : { categoryId }),
})

describe('isolation of transactions', () => {
  const { as, anonymous, world, prisma, unchanged, expectNotFound } = useIntegrationApp()

  const patch = (persona: Persona, id: string, body: object) => as(persona).patch(`/api/transactions/${id}`, body)

  it('turns a request without a token away', async () => {
    await anonymous().get('/api/transactions').expect(401)
  })

  describe('POST /api/transactions', () => {
    it('answers 404 for an account of another user and writes nothing', async () => {
      const { a, b } = world()

      await expectNotFound(
        (id) => as(a).post('/api/transactions', expense(id, a.categories.food)),
        b.accounts.main,
        'Account not found',
      )
    })

    it('answers 404 for an own account with a category of another user', async () => {
      const { a, b } = world()

      await expectNotFound(
        (id) => as(a).post('/api/transactions', expense(a.accounts.main, id)),
        b.categories.food,
        'Category not found',
      )
    })

    it('answers 404 for an account of another user with its own category, the account first', async () => {
      const { a, b } = world()

      await expectNotFound(
        (id) => as(a).post('/api/transactions', expense(id, b.categories.food)),
        b.accounts.main,
        'Account not found',
      )
    })

    it('creates a transaction on an own account with an own category (control)', async () => {
      const { a } = world()

      const response = await as(a).post('/api/transactions', expense(a.accounts.main, a.categories.food)).expect(201)
      const id = (response.body as { id: string }).id

      expect(await prisma().transaction.findUniqueOrThrow({ where: { id } })).toMatchObject({
        accountId: a.accounts.main,
        categoryId: a.categories.food,
      })
    })
  })

  describe('GET /api/transactions/:id', () => {
    it('answers 404 for a transaction of another user', async () => {
      const { a, b } = world()

      await expectNotFound((id) => as(a).get(`/api/transactions/${id}`), b.transactions.income, 'Transaction not found')
    })

    it('answers 404 for a side of a transfer of another user', async () => {
      const { a, b } = world()

      await expectNotFound((id) => as(a).get(`/api/transactions/${id}`), b.transfer.out, 'Transaction not found')
    })

    it('returns an own transaction and an own side of a transfer (control)', async () => {
      const { a } = world()

      const income = await as(a).get(`/api/transactions/${a.transactions.income}`).expect(200)
      const side = await as(a).get(`/api/transactions/${a.transfer.out}`).expect(200)

      expect(income.body).toMatchObject({ id: a.transactions.income, accountId: a.accounts.main, type: 'income' })
      expect(side.body).toMatchObject({
        id: a.transfer.out,
        transferPairId: a.transfer.pairId,
        transferDirection: 'out',
      })
    })
  })

  describe('PATCH /api/transactions/:id', () => {
    it('answers 404 for a transaction of another user and changes nothing', async () => {
      const { a, b } = world()

      await expectNotFound((id) => patch(a, id, { amount: '1' }), b.transactions.income, 'Transaction not found')
    })

    it('answers 404 for a side of a transfer of another user, not the 409 its owner gets', async () => {
      const { a, b } = world()

      await expectNotFound((id) => patch(a, id, { amount: '1' }), b.transfer.out, 'Transaction not found')
    })

    it('answers 404 for a transaction of another user moved to an own account in another currency, not 409', async () => {
      const { a, b } = world()

      await expectNotFound(
        (id) => patch(a, id, { accountId: a.accounts.euro }),
        b.transactions.income,
        'Transaction not found',
      )
    })

    it('answers 404 for a move of an own transaction to an account of another user', async () => {
      const { a, b } = world()

      await expectNotFound(
        (id) => patch(a, a.transactions.income, { accountId: id }),
        b.accounts.savings,
        'Account not found',
      )
    })

    it('answers 404 for a move to an account of another user in another currency, not 409', async () => {
      const { a, b } = world()

      await expectNotFound(
        (id) => patch(a, a.transactions.income, { accountId: id }),
        b.accounts.euro,
        'Account not found',
      )
    })

    it('answers 404 for a category of another user on an own transaction', async () => {
      const { a, b } = world()

      await expectNotFound(
        (id) => patch(a, a.transactions.income, { categoryId: id }),
        b.categories.salary,
        'Category not found',
      )
    })

    it('changes an own transaction and moves it to an own account (control)', async () => {
      const { a } = world()

      const response = await patch(a, a.transactions.income, { amount: '1', accountId: a.accounts.savings }).expect(200)

      expect(response.body).toMatchObject({ amount: '1.0000', accountId: a.accounts.savings })
    })

    it('refuses an own move to another currency and an own side of a transfer (control)', async () => {
      const { a } = world()

      const currency = await unchanged(() =>
        patch(a, a.transactions.income, { accountId: a.accounts.euro }).expect(409),
      )
      const side = await unchanged(() => patch(a, a.transfer.out, { amount: '1' }).expect(409))

      expect(currency.body).toStrictEqual(conflict('A transaction cannot move to an account in another currency'))
      expect(side.body).toStrictEqual(conflict('Transaction is part of a transfer and cannot be changed here'))
    })
  })

  describe('DELETE /api/transactions/:id', () => {
    it('answers 404 for a transaction of another user and keeps it', async () => {
      const { a, b } = world()

      await expectNotFound(
        (id) => as(a).delete(`/api/transactions/${id}`),
        b.transactions.expense,
        'Transaction not found',
      )
    })

    it('answers 404 for a side of a transfer of another user, not the 409 its owner gets', async () => {
      const { a, b } = world()

      await expectNotFound((id) => as(a).delete(`/api/transactions/${id}`), b.transfer.in, 'Transaction not found')
    })

    it('refuses an own side of a transfer and deletes an own expense (control)', async () => {
      const { a } = world()

      const side = await unchanged(() => as(a).delete(`/api/transactions/${a.transfer.in}`).expect(409))
      await as(a).delete(`/api/transactions/${a.transactions.expense}`).expect(204)

      expect(side.body).toStrictEqual(conflict('Transaction is part of a transfer and cannot be changed here'))
      expect(await prisma().transaction.count({ where: { id: a.transactions.expense } })).toBe(0)
    })
  })
})
