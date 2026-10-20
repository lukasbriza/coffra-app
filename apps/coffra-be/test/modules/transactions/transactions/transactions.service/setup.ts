import 'reflect-metadata'

import { beforeEach, vi } from 'vitest'

import { OwnershipService } from '../../../../../src/modules/core/ownership/ownership.service'
import type { Owner } from '../../../../../src/modules/core/ownership/ownership.types'
import {
  type Account,
  type Category,
  Prisma,
  type PrismaService,
  type Transaction,
  TransactionType,
  TransferDirection,
} from '../../../../../src/modules/prisma'
import { TransactionsService } from '../../../../../src/modules/transactions/transactions/transactions.service'
import type {
  OwnedTransaction,
  TransactionView,
} from '../../../../../src/modules/transactions/transactions/transactions.types'

// Shared by the use case specs of `TransactionsService` (findOne, create, update, remove). The ownership layer is the
// real one: the specs pin the `where` it produces, not a mock of it.

export { prismaError } from '../../prisma-error'

export const OWNER: Owner = { userId: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11' }
export const TRANSACTION_ID = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d'
export const ACCOUNT_ID = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d'
export const OTHER_ACCOUNT_ID = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e'
export const CATEGORY_ID = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f'
export const PAIR_ID = '1f2e3d4c-5b6a-4987-8a6b-5c4d3e2f1a0b'

/** The read of `TRANSACTION_ID`: the id and the owner scope through the account, with the account currency. */
export const OWNED_READ = {
  where: { id: TRANSACTION_ID, account: { userId: OWNER.userId } },
  include: { account: { select: { currency: true } } },
}

/** The `where` of every write on `TRANSACTION_ID`: the owner scope through the account, income or expense only. */
export const EDITABLE = {
  id: TRANSACTION_ID,
  account: { userId: OWNER.userId },
  type: { in: [TransactionType.income, TransactionType.expense] },
}

/** The read of an account the input points to. */
export const accountRead = (id: string) => ({ where: { id, userId: OWNER.userId }, select: { currency: true } })

/** The read of a category the input points to. */
export const categoryRead = (id: string) => ({ where: { id, userId: OWNER.userId }, select: { id: true } })

export const row = (overrides: Partial<OwnedTransaction> = {}): OwnedTransaction => ({
  id: TRANSACTION_ID,
  accountId: ACCOUNT_ID,
  type: TransactionType.expense,
  amount: new Prisma.Decimal('1250.5'),
  date: new Date('2026-10-19T00:00:00.000Z'),
  note: 'Lunch',
  categoryId: CATEGORY_ID,
  transferPairId: null,
  transferDirection: null,
  createdAt: new Date('2026-10-19T08:00:00Z'),
  updatedAt: new Date('2026-10-19T08:00:00Z'),
  account: { currency: 'CZK' },
  ...overrides,
})

/** The outgoing side of a transfer. */
export const transferRow = (): OwnedTransaction =>
  row({
    type: TransactionType.transfer,
    categoryId: null,
    note: null,
    transferPairId: PAIR_ID,
    transferDirection: TransferDirection.out,
  })

/** What the API shows of `row()`. */
export const VIEW: TransactionView = {
  id: TRANSACTION_ID,
  accountId: ACCOUNT_ID,
  type: TransactionType.expense,
  amount: '1250.5000',
  date: '2026-10-19',
  note: 'Lunch',
  categoryId: CATEGORY_ID,
  transferPairId: null,
  transferDirection: null,
}

/** A create input that points to an own account and an own category. */
export const INPUT = {
  accountId: ACCOUNT_ID,
  type: TransactionType.expense,
  amount: '1250.5',
  date: '2026-10-19',
  categoryId: CATEGORY_ID,
  note: 'Lunch',
} as const

/**
 * The service over a mocked Prisma and the real ownership layer. Call it inside a `describe`: it registers the
 * `beforeEach` that resets the mocks for that block. Unless a spec says otherwise, the transaction is `row()` and the
 * account (CZK) and the category the input points to exist.
 */
export const useTransactionsService = () => {
  const findTransaction = vi.fn<(args: unknown) => Promise<OwnedTransaction | null>>()
  const create = vi.fn<(args: unknown) => Promise<Transaction>>()
  const update = vi.fn<(args: unknown) => Promise<Transaction>>()
  const remove = vi.fn<(args: unknown) => Promise<Transaction>>()
  const findAccount = vi.fn<(args: unknown) => Promise<Pick<Account, 'currency'> | null>>()
  const findCategory = vi.fn<(args: unknown) => Promise<Pick<Category, 'id'> | null>>()
  const prisma = {
    transaction: { findFirst: findTransaction, create, update, delete: remove },
    account: { findFirst: findAccount },
    category: { findFirst: findCategory },
  } as unknown as PrismaService
  const service = new TransactionsService(prisma, new OwnershipService())

  beforeEach(() => {
    findTransaction.mockReset().mockResolvedValue(row())
    create.mockReset().mockResolvedValue(row())
    update.mockReset().mockResolvedValue(row())
    remove.mockReset().mockResolvedValue(row())
    findAccount.mockReset().mockResolvedValue({ currency: 'CZK' })
    findCategory.mockReset().mockResolvedValue({ id: CATEGORY_ID })
  })

  return { service, findTransaction, create, update, remove, findAccount, findCategory }
}
