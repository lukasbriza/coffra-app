import 'reflect-metadata'

import { beforeEach, vi } from 'vitest'

import { OwnershipService } from '../../../../../src/modules/core/ownership/ownership.service'
import type { Owner } from '../../../../../src/modules/core/ownership/ownership.types'
import { Prisma, type PrismaService, TransactionType } from '../../../../../src/modules/prisma'
import { TransactionTotalsService } from '../../../../../src/modules/transactions/totals/totals.service'
import type { TotalsRange } from '../../../../../src/modules/transactions/totals/totals.types'

// Shared by the use case specs of `TransactionTotalsService`. The ownership layer is the real one: the specs pin the
// `where` it produces, not a mock of it.

export const OWNER: Owner = { userId: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11' }

export const CZK_1 = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d'
export const CZK_2 = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e'
export const EUR_1 = '7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f'
export const FOOD = '11111111-1111-4111-8111-111111111111'
export const SALARY = '33333333-3333-4333-8333-333333333333'

export const RANGE: TotalsRange = { from: '2026-08-01', to: '2026-10-31' }

/** Midnight UTC of the first and the last day of `RANGE`: what the `DATE` column is compared with. */
export const FROM = new Date('2026-08-01T00:00:00.000Z')
export const TO = new Date('2026-10-31T00:00:00.000Z')

/** One row of what `groupBy` returns: the sum of the amounts of a kind of transaction of an account and category. */
export type Group = {
  accountId: string
  categoryId: string | null
  type: TransactionType
  _sum: { amount: Prisma.Decimal | null }
}

export const group = (accountId: string, categoryId: string | null, type: TransactionType, amount: string): Group => ({
  accountId,
  categoryId,
  type,
  _sum: { amount: new Prisma.Decimal(amount) },
})

export const income = (accountId: string, categoryId: string | null, amount: string): Group =>
  group(accountId, categoryId, TransactionType.income, amount)
export const expense = (accountId: string, categoryId: string | null, amount: string): Group =>
  group(accountId, categoryId, TransactionType.expense, amount)

/**
 * The one aggregation behind every answer: the owner scope through the account, no transfers, both days of the range
 * as bounds of midnight UTC.
 */
export const groupQuery = (from: Date = FROM, to: Date = TO) => ({
  by: ['accountId', 'categoryId', 'type'],
  where: {
    account: { userId: OWNER.userId },
    type: { in: ['income', 'expense'] },
    date: { gte: from, lte: to },
  },
  _sum: { amount: true },
})

type AccountRow = { id: string; currency: string }
type CategoryRow = { id: string; name: string }

/**
 * The service over a mocked Prisma and the real ownership layer. Call it inside a `describe`: it registers the
 * `beforeEach` that resets the mocks for that block. Nothing is found unless a spec says otherwise.
 */
export const useTotalsService = () => {
  const groupBy = vi.fn<(args: unknown) => Promise<Group[]>>()
  const findAccounts = vi.fn<(args: unknown) => Promise<AccountRow[]>>()
  const findCategories = vi.fn<(args: unknown) => Promise<CategoryRow[]>>()
  const prisma = {
    transaction: { groupBy },
    account: { findMany: findAccounts },
    category: { findMany: findCategories },
  } as unknown as PrismaService
  const service = new TransactionTotalsService(prisma, new OwnershipService())

  beforeEach(() => {
    groupBy.mockReset().mockResolvedValue([])
    findAccounts.mockReset().mockResolvedValue([])
    findCategories.mockReset().mockResolvedValue([])
  })

  return { service, groupBy, findAccounts, findCategories }
}
