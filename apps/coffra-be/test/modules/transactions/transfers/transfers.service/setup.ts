import 'reflect-metadata'

import { beforeEach, vi } from 'vitest'

import { OwnershipService } from '../../../../../src/modules/core/ownership/ownership.service'
import type { Owner } from '../../../../../src/modules/core/ownership/ownership.types'
import {
  type Account,
  Prisma,
  type PrismaService,
  type Transaction,
  TransactionType,
  TransferDirection,
} from '../../../../../src/modules/prisma'
import { TransfersService } from '../../../../../src/modules/transactions/transfers/transfers.service'
import type { OwnedTransaction, TransferView } from '../../../../../src/modules/transactions/transfers/transfers.types'

// Shared by the use case specs of `TransfersService` (create, update, remove). The ownership layer is the real one:
// the specs pin the `where` it produces, not a mock of it.

export { prismaError } from '../../prisma-error'

export const OWNER: Owner = { userId: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11' }
export const PAIR_ID = '1f2e3d4c-5b6a-4987-8a6b-5c4d3e2f1a0b'
export const FROM_ACCOUNT_ID = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d'
export const TO_ACCOUNT_ID = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e'
export const OTHER_ACCOUNT_ID = '7c8d9e0f-1a2b-4c3d-8e4f-5a6b7c8d9e0f'

/** The read of both sides of `PAIR_ID`: the pair and the owner scope through the account, with its currency. */
export const PAIR_READ = {
  where: { transferPairId: PAIR_ID, account: { userId: OWNER.userId } },
  include: { account: { select: { currency: true } } },
}

/** The `where` of the write of one side of `PAIR_ID`: the unique pair and direction, the owner scope. */
export const sideWhere = (transferDirection: TransferDirection) => ({
  transferPairId_transferDirection: { transferPairId: PAIR_ID, transferDirection },
  account: { userId: OWNER.userId },
})

/** The read of an account the input points to. */
export const accountRead = (id: string) => ({ where: { id, userId: OWNER.userId }, select: { currency: true } })

/** One side of the stored transfer `FROM_ACCOUNT_ID` → `TO_ACCOUNT_ID`, CZK. */
export const side = (
  transferDirection: TransferDirection,
  overrides: Partial<OwnedTransaction> = {},
): OwnedTransaction => ({
  id:
    transferDirection === TransferDirection.out
      ? 'a1b2c3d4-0000-4000-8000-000000000001'
      : 'a1b2c3d4-0000-4000-8000-000000000002',
  accountId: transferDirection === TransferDirection.out ? FROM_ACCOUNT_ID : TO_ACCOUNT_ID,
  type: TransactionType.transfer,
  amount: new Prisma.Decimal('5000'),
  date: new Date('2026-10-21T00:00:00.000Z'),
  note: 'Savings',
  categoryId: null,
  transferPairId: PAIR_ID,
  transferDirection,
  createdAt: new Date('2026-10-21T08:00:00Z'),
  updatedAt: new Date('2026-10-21T08:00:00Z'),
  account: { currency: 'CZK' },
  ...overrides,
})

/** Both sides of the stored transfer, `out` first. */
export const pair = (): OwnedTransaction[] => [side(TransferDirection.out), side(TransferDirection.in)]

/** What the API shows of `pair()`. */
export const VIEW: TransferView = {
  pairId: PAIR_ID,
  fromAccountId: FROM_ACCOUNT_ID,
  toAccountId: TO_ACCOUNT_ID,
  amount: '5000.0000',
  date: '2026-10-21',
  note: 'Savings',
}

/** A create input between two own accounts of the same currency. */
export const INPUT = {
  fromAccountId: FROM_ACCOUNT_ID,
  toAccountId: TO_ACCOUNT_ID,
  amount: '5000',
  date: '2026-10-21',
  note: 'Savings',
} as const

type UpdateArgs = { where: ReturnType<typeof sideWhere> }

/**
 * The service over a mocked Prisma and the real ownership layer. Call it inside a `describe`: it registers the
 * `beforeEach` that resets the mocks for that block. Unless a spec says otherwise, the stored transfer is `pair()`, the
 * accounts the input points to exist in CZK, every write succeeds and `$transaction` runs the operations it gets.
 */
export const useTransfersService = () => {
  const findMany = vi.fn<(args: unknown) => Promise<OwnedTransaction[]>>()
  const createManyAndReturn = vi.fn<(args: unknown) => Promise<Transaction[]>>()
  const update = vi.fn<(args: UpdateArgs) => Promise<Transaction>>()
  const deleteMany = vi.fn<(args: unknown) => Promise<{ count: number }>>()
  const findAccount = vi.fn<(args: unknown) => Promise<Pick<Account, 'currency'> | null>>()
  const $transaction = vi.fn<(operations: Promise<unknown>[]) => Promise<unknown[]>>()
  const prisma = {
    transaction: { findMany, createManyAndReturn, update, deleteMany },
    account: { findFirst: findAccount },
    $transaction,
  } as unknown as PrismaService
  const service = new TransfersService(prisma, new OwnershipService())

  beforeEach(() => {
    findMany.mockReset().mockResolvedValue(pair())
    createManyAndReturn.mockReset().mockResolvedValue(pair())
    // The side the `where` asks for, so the order of the writes shows in the result.
    update
      .mockReset()
      .mockImplementation(({ where }) =>
        Promise.resolve(side(where.transferPairId_transferDirection.transferDirection)),
      )
    deleteMany.mockReset().mockResolvedValue({ count: 2 })
    findAccount.mockReset().mockResolvedValue({ currency: 'CZK' })
    $transaction.mockReset().mockImplementation((operations) => Promise.all(operations))
  })

  return { service, findMany, createManyAndReturn, update, deleteMany, findAccount, $transaction }
}
