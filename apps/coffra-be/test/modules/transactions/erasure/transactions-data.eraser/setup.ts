import 'reflect-metadata'

import { beforeEach, vi } from 'vitest'

import { type Owner, OwnershipService } from '../../../../../src/modules/core'
import type { Prisma } from '../../../../../src/modules/prisma'
import { TransactionsDataEraser } from '../../../../../src/modules/transactions/erasure/transactions-data.eraser'

// Shared by the use case specs of `TransactionsDataEraser`.

export const OWNER: Owner = { userId: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11' }

/**
 * The eraser with the real `OwnershipService` over a mocked transaction client. Call it inside a `describe`: it
 * registers the `beforeEach` that resets the mocks for that block.
 *
 * Every `deleteMany` writes the model into `log`, so a spec can pin the order.
 */
export const useTransactionsDataEraser = () => {
  const log: string[] = []
  const deleteMany = (model: string) =>
    vi.fn<(args: unknown) => Promise<{ count: number }>>(() => {
      log.push(model)
      return Promise.resolve({ count: 1 })
    })
  const tx = {
    transaction: { deleteMany: deleteMany('transaction') },
    account: { deleteMany: deleteMany('account') },
    category: { deleteMany: deleteMany('category') },
  }
  const eraser = new TransactionsDataEraser(new OwnershipService())

  beforeEach(() => {
    log.length = 0
    tx.transaction.deleteMany.mockClear()
    tx.account.deleteMany.mockClear()
    tx.category.deleteMany.mockClear()
  })

  return { eraser, tx, client: tx as unknown as Prisma.TransactionClient, log }
}
