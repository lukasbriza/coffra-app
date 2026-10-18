import 'reflect-metadata'

import { beforeEach, vi } from 'vitest'

import { OwnershipService } from '../../../../../src/modules/core/ownership/ownership.service'
import type { Owner } from '../../../../../src/modules/core/ownership/ownership.types'
import { type Account, AccountType, Prisma, type PrismaService } from '../../../../../src/modules/prisma'
import { AccountsService } from '../../../../../src/modules/transactions/accounts/accounts.service'

// Shared by the use case specs of `AccountsService` (list, findOne, create, update, remove). The ownership layer is
// the real one: the specs pin the `where` it produces, not a mock of it.

export const OWNER: Owner = { userId: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11' }
export const ACCOUNT_ID = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d'

/** The `where` of every query for `ACCOUNT_ID` of `OWNER`: the id and the owner scope, nothing else. */
export const OWNED = { id: ACCOUNT_ID, userId: OWNER.userId }

export const row = (overrides: Partial<Account> = {}): Account => ({
  id: ACCOUNT_ID,
  userId: OWNER.userId,
  tenantId: null,
  name: 'Main account',
  type: AccountType.bank,
  currency: 'CZK',
  openingBalance: new Prisma.Decimal('1250.5'),
  createdAt: new Date('2026-10-06T08:00:00Z'),
  updatedAt: new Date('2026-10-06T08:00:00Z'),
  ...overrides,
})

/** What the API shows of `row()`. */
export const VIEW = {
  id: ACCOUNT_ID,
  name: 'Main account',
  type: AccountType.bank,
  currency: 'CZK',
  openingBalance: '1250.5000',
}

export const prismaError = (code: string): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError(`query failed with ${code}`, { code, clientVersion: '7.8.0' })

/**
 * The service over a mocked Prisma and the real ownership layer. Call it inside a `describe`: it registers the
 * `beforeEach` that resets the mocks for that block. `findFirst` finds `row()` unless a spec says otherwise.
 */
export const useAccountsService = () => {
  const findMany = vi.fn<(args: unknown) => Promise<Account[]>>()
  const findFirst = vi.fn<(args: unknown) => Promise<Account | null>>()
  const create = vi.fn<(args: unknown) => Promise<Account>>()
  const update = vi.fn<(args: unknown) => Promise<Account>>()
  const remove = vi.fn<(args: unknown) => Promise<Account>>()
  const prisma = { account: { findMany, findFirst, create, update, delete: remove } } as unknown as PrismaService
  const service = new AccountsService(prisma, new OwnershipService())

  beforeEach(() => {
    findMany.mockReset()
    findFirst.mockReset().mockResolvedValue(row())
    create.mockReset()
    update.mockReset()
    remove.mockReset()
  })

  return { service, findMany, findFirst, create, update, remove }
}
