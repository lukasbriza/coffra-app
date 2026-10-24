import 'reflect-metadata'

import { afterEach, beforeEach, vi } from 'vitest'

import { OwnershipService } from '../../../../../src/modules/core/ownership/ownership.service'
import type { Owner } from '../../../../../src/modules/core/ownership/ownership.types'
import {
  type Account,
  AccountType,
  Prisma,
  type PrismaService,
  TransactionType,
  type TransferDirection,
} from '../../../../../src/modules/prisma'
import { AccountsService } from '../../../../../src/modules/transactions/accounts/accounts.service'

// Shared by the use case specs of `AccountsService` (list, findOne, create, update, remove). The ownership layer is
// the real one: the specs pin the `where` it produces, not a mock of it.

export { prismaError } from '../../prisma-error'

export const OWNER: Owner = { userId: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11' }
export const ACCOUNT_ID = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d'

/** The clock of every spec: late on 22 October 2026, UTC. */
export const NOW = new Date('2026-10-22T10:30:00.000Z')

/** Midnight UTC of the day of `NOW`: the bound of the balance when no day is asked for. */
export const TODAY = new Date('2026-10-22T00:00:00.000Z')

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

/** What the API shows of `row()` when it has no transactions: the balance is the opening balance. */
export const VIEW = {
  id: ACCOUNT_ID,
  name: 'Main account',
  type: AccountType.bank,
  currency: 'CZK',
  openingBalance: '1250.5000',
  balance: '1250.5000',
}

/** One row of what `groupBy` returns: the sum of the amounts of a kind of transaction of an account. */
export type Group = {
  accountId: string
  type: TransactionType
  transferDirection: TransferDirection | null
  _sum: { amount: Prisma.Decimal | null }
}

export const group = (
  type: TransactionType,
  amount: string,
  transferDirection: TransferDirection | null = null,
  accountId = ACCOUNT_ID,
): Group => ({ accountId, type, transferDirection, _sum: { amount: new Prisma.Decimal(amount) } })

export const income = (amount: string, accountId = ACCOUNT_ID): Group =>
  group(TransactionType.income, amount, null, accountId)
export const expense = (amount: string, accountId = ACCOUNT_ID): Group =>
  group(TransactionType.expense, amount, null, accountId)

/**
 * The one aggregation behind every balance, for exactly these accounts and up to `lte`: the owner scope through the
 * account, the ids only narrow it, the day is a bound of midnight UTC.
 */
export const totalsQuery = (accountIds: string[], lte: Date = TODAY) => ({
  by: ['accountId', 'type', 'transferDirection'],
  where: { account: { userId: OWNER.userId }, accountId: { in: accountIds }, date: { lte } },
  _sum: { amount: true },
})

/**
 * The service over a mocked Prisma and the real ownership layer. Call it inside a `describe`: it registers the
 * `beforeEach` that resets the mocks for that block and fixes the clock at `NOW` (only `Date`, timers run as usual).
 * `findFirst` finds `row()` and `groupBy` finds no transactions unless a spec says otherwise.
 */
export const useAccountsService = () => {
  const findMany = vi.fn<(args: unknown) => Promise<Account[]>>()
  const findFirst = vi.fn<(args: unknown) => Promise<Account | null>>()
  const create = vi.fn<(args: unknown) => Promise<Account>>()
  const update = vi.fn<(args: unknown) => Promise<Account>>()
  const remove = vi.fn<(args: unknown) => Promise<Account>>()
  const groupBy = vi.fn<(args: unknown) => Promise<Group[]>>()
  const prisma = {
    account: { findMany, findFirst, create, update, delete: remove },
    transaction: { groupBy },
  } as unknown as PrismaService
  const service = new AccountsService(prisma, new OwnershipService())

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    findMany.mockReset()
    findFirst.mockReset().mockResolvedValue(row())
    create.mockReset()
    update.mockReset()
    remove.mockReset()
    groupBy.mockReset().mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  return { service, findMany, findFirst, create, update, remove, groupBy }
}
