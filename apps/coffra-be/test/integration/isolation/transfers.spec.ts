import { describe, expect, it } from 'vitest'

import { conflict } from '../support/responses'
import { useIntegrationApp } from '../support/use-integration-app'
import type { Persona } from '../support/world'

/**
 * A valid body of a transfer.
 *
 * @param fromAccountId - the source account
 * @param toAccountId - the target account
 * @returns the body of `POST /api/transfers`
 */
const transfer = (fromAccountId: string, toAccountId: string): Record<string, string> => ({
  fromAccountId,
  toAccountId,
  amount: '10',
  date: '2026-02-01',
})

describe('isolation of transfers', () => {
  const { as, anonymous, world, prisma, unchanged, expectNotFound } = useIntegrationApp()

  const patch = (persona: Persona, pairId: string, body: object) => as(persona).patch(`/api/transfers/${pairId}`, body)

  const sidesOf = (pairId: string) =>
    prisma().transaction.findMany({ where: { transferPairId: pairId }, orderBy: { transferDirection: 'asc' } })

  it('turns a request without a token away', async () => {
    await anonymous().post('/api/transfers', {}).expect(401)
  })

  describe('POST /api/transfers', () => {
    it('answers 404 for a transfer to an account of another user and writes nothing', async () => {
      const { a, b } = world()

      await expectNotFound(
        (id) => as(a).post('/api/transfers', transfer(a.accounts.main, id)),
        b.accounts.savings,
        'Account not found',
      )
    })

    it('answers 404 for a transfer from an account of another user and writes nothing', async () => {
      const { a, b } = world()

      await expectNotFound(
        (id) => as(a).post('/api/transfers', transfer(id, a.accounts.savings)),
        b.accounts.main,
        'Account not found',
      )
    })

    it('answers 404 for a transfer to an account of another user in another currency, not 409', async () => {
      const { a, b } = world()

      await expectNotFound(
        (id) => as(a).post('/api/transfers', transfer(a.accounts.main, id)),
        b.accounts.euro,
        'Account not found',
      )
    })

    it('creates both sides between own accounts (control)', async () => {
      const { a } = world()

      const response = await as(a).post('/api/transfers', transfer(a.accounts.main, a.accounts.savings)).expect(201)
      const sides = await sidesOf((response.body as { pairId: string }).pairId)

      expect(sides.map(({ accountId, transferDirection }) => [accountId, transferDirection])).toStrictEqual([
        [a.accounts.main, 'out'],
        [a.accounts.savings, 'in'],
      ])
    })

    it('refuses own accounts in two currencies (control)', async () => {
      const { a } = world()

      const response = await unchanged(() =>
        as(a).post('/api/transfers', transfer(a.accounts.main, a.accounts.euro)).expect(409),
      )

      expect(response.body).toStrictEqual(conflict('A transfer needs two accounts in the same currency'))
    })
  })

  describe('PATCH /api/transfers/:pairId', () => {
    it('answers 404 for a transfer of another user and changes neither side', async () => {
      const { a, b } = world()

      await expectNotFound((id) => patch(a, id, { amount: '1' }), b.transfer.pairId, 'Transfer not found')
    })

    it('answers 404 for a transfer of another user moved to an own account in another currency, not 409', async () => {
      const { a, b } = world()

      await expectNotFound(
        (id) => patch(a, id, { toAccountId: a.accounts.euro }),
        b.transfer.pairId,
        'Transfer not found',
      )
    })

    it('answers 404 for a transfer of another user moved onto its own source account, not 409', async () => {
      const { a, b } = world()

      await expectNotFound(
        (id) => patch(a, id, { toAccountId: b.accounts.main }),
        b.transfer.pairId,
        'Transfer not found',
      )
    })

    it('answers 404 for a move of an own transfer to an account of another user', async () => {
      const { a, b } = world()

      await expectNotFound(
        (id) => patch(a, a.transfer.pairId, { toAccountId: id }),
        b.accounts.savings,
        'Account not found',
      )
    })

    it('answers 404 for a move of an own transfer from an account of another user', async () => {
      const { a, b } = world()

      await expectNotFound(
        (id) => patch(a, a.transfer.pairId, { fromAccountId: id }),
        b.accounts.main,
        'Account not found',
      )
    })

    it('answers 404 for a move to an account of another user in another currency, not 409', async () => {
      const { a, b } = world()

      await expectNotFound(
        (id) => patch(a, a.transfer.pairId, { toAccountId: id }),
        b.accounts.euro,
        'Account not found',
      )
    })

    it('changes an own transfer and moves it to an own account (control)', async () => {
      const { a } = world()

      const response = await patch(a, a.transfer.pairId, { amount: '12.5', toAccountId: a.accounts.empty }).expect(200)

      expect(response.body).toMatchObject({
        pairId: a.transfer.pairId,
        amount: '12.5000',
        toAccountId: a.accounts.empty,
      })
    })

    it('refuses an own move to another currency (control)', async () => {
      const { a } = world()

      const response = await unchanged(() => patch(a, a.transfer.pairId, { toAccountId: a.accounts.euro }).expect(409))

      expect(response.body).toStrictEqual(conflict('A transfer cannot move to an account in another currency'))
    })
  })

  describe('DELETE /api/transfers/:pairId', () => {
    it('answers 404 for a transfer of another user and keeps both sides', async () => {
      const { a, b } = world()

      await expectNotFound((id) => as(a).delete(`/api/transfers/${id}`), b.transfer.pairId, 'Transfer not found')
      expect(await sidesOf(b.transfer.pairId)).toHaveLength(2)
    })

    it('deletes both sides of an own transfer (control)', async () => {
      const { a } = world()

      await as(a).delete(`/api/transfers/${a.transfer.pairId}`).expect(204)

      expect(await sidesOf(a.transfer.pairId)).toStrictEqual([])
    })
  })
})
