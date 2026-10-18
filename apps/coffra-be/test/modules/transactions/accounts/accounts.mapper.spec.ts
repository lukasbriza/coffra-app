import { describe, expect, it } from 'vitest'

import { type Account, AccountType, Prisma } from '../../../../src/modules/prisma'
import { toAccountView } from '../../../../src/modules/transactions/accounts/accounts.mapper'

const row = (overrides: Partial<Account> = {}): Account => ({
  id: '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d',
  userId: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11',
  tenantId: null,
  name: 'Main account',
  type: AccountType.bank,
  currency: 'CZK',
  openingBalance: new Prisma.Decimal('1250.5'),
  createdAt: new Date('2026-10-06T08:00:00Z'),
  updatedAt: new Date('2026-10-06T08:00:00Z'),
  ...overrides,
})

describe('toAccountView', () => {
  it('keeps the fields the API shows, with the amount as a decimal string', () => {
    expect(toAccountView(row())).toStrictEqual({
      id: '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d',
      name: 'Main account',
      type: 'bank',
      currency: 'CZK',
      openingBalance: '1250.5000',
    })
  })

  it('leaves out the owner columns and the timestamps, even when tenantId is set', () => {
    const view = toAccountView(row({ tenantId: '7d1c2b9a-5e4f-4a3b-8c2d-1e0f9a8b7c62' }))

    expect(Object.keys(view).toSorted()).toEqual(['currency', 'id', 'name', 'openingBalance', 'type'])
  })

  it.each([
    ['0', '0.0000'],
    ['-1500.25', '-1500.2500'],
    ['999999999999999.9999', '999999999999999.9999'],
  ])('writes the opening balance %s as %s', (stored, expected) => {
    expect(toAccountView(row({ openingBalance: new Prisma.Decimal(stored) })).openingBalance).toBe(expected)
  })
})
