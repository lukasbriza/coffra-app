import { randomUUID } from 'node:crypto'

import { describe, expect, it, type MockInstance, vi } from 'vitest'

import type { Owner } from '../../../src/modules/core'
import { TransfersService } from '../../../src/modules/transactions/transfers/transfers.service'
import { useIntegrationApp } from '../support/use-integration-app'

/** The private account check of `TransfersService`, reached for the spy only. */
type AccountCheck = { findAccount: (owner: Owner, accountId: string) => Promise<{ currency: string }> }

/**
 * How many times the spy checked one account id.
 *
 * @param checks - the spy on the account check
 * @param id - the account id
 * @returns the number of checks of that id
 */
const checksOf = (checks: MockInstance<AccountCheck['findAccount']>, id: string): number =>
  checks.mock.calls.filter(([, accountId]) => accountId === id).length

// Both sides of a transfer are written by one statement or one database transaction: when the write of one side fails,
// the other is not written either. The failure is forced on the foreign key: the account check of the service passes
// once for an account that does not exist, as if it had been deleted right after the check.
describe('a transfer is written whole or not at all', () => {
  const { as, world, app, unchanged } = useIntegrationApp()

  /**
   * An account id the account check accepts once (in CZK, like the accounts of the seed) and that the database does
   * not have. Every other check runs as usual, so after the failed write the service reads it again and answers 404.
   *
   * @returns the id and the spy, to count the checks of that id
   */
  const phantomAccount = (): { id: string; checks: MockInstance<AccountCheck['findAccount']> } => {
    const service = app().get<TransfersService, AccountCheck>(TransfersService)
    const original = service.findAccount.bind(service)
    const id = randomUUID()
    let accepted = false

    const checks = vi.spyOn(service, 'findAccount').mockImplementation(async (owner, accountId) => {
      if (accountId === id && !accepted) {
        accepted = true
        return { currency: 'CZK' }
      }

      return original(owner, accountId)
    })

    return { id, checks }
  }

  describe('POST /api/transfers', () => {
    it.each(['out', 'in'] as const)('writes no side when the %s side fails', async (side) => {
      const { a } = world()
      const phantom = phantomAccount()
      const accounts =
        side === 'in'
          ? { fromAccountId: a.accounts.main, toAccountId: phantom.id }
          : { fromAccountId: phantom.id, toAccountId: a.accounts.savings }

      const response = await unchanged(() =>
        as(a)
          .post('/api/transfers', { ...accounts, amount: '10', date: '2026-02-01' })
          .expect(404),
      )

      expect((response.body as { message: string }).message).toBe('Account not found')
      // Accepted, the INSERT failed on its foreign key, read again: the write was really attempted.
      expect(checksOf(phantom.checks, phantom.id)).toBe(2)
    })

    it('writes both sides with the spy in place for accounts that exist (control)', async () => {
      const { a } = world()
      phantomAccount()

      await as(a)
        .post('/api/transfers', {
          fromAccountId: a.accounts.main,
          toAccountId: a.accounts.savings,
          amount: '10',
          date: '2026-02-01',
        })
        .expect(201)
    })
  })

  describe('PATCH /api/transfers/:pairId', () => {
    it.each([
      ['the second UPDATE (in) fails, the first one is rolled back', 'toAccountId'],
      ['the first UPDATE (out) fails', 'fromAccountId'],
    ] as const)('changes no side when %s', async (_case, field) => {
      const { a } = world()
      const phantom = phantomAccount()

      const response = await unchanged(() =>
        as(a)
          .patch(`/api/transfers/${a.transfer.pairId}`, { amount: '999', note: 'changed', [field]: phantom.id })
          .expect(404),
      )

      expect((response.body as { message: string }).message).toBe('Account not found')
      expect(checksOf(phantom.checks, phantom.id)).toBe(2)
    })

    it('changes both sides with the spy in place for an account that exists (control)', async () => {
      const { a } = world()
      phantomAccount()

      const response = await as(a)
        .patch(`/api/transfers/${a.transfer.pairId}`, { amount: '999', toAccountId: a.accounts.empty })
        .expect(200)

      expect(response.body).toMatchObject({ amount: '999.0000', toAccountId: a.accounts.empty })
    })
  })
})
