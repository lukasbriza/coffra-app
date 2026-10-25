import { beforeEach, vi } from 'vitest'

import { TransactionsController } from '../../../../../src/modules/transactions/transactions/transactions.controller'
import { TransactionsService } from '../../../../../src/modules/transactions/transactions/transactions.service'
import type {
  TransactionPage,
  TransactionView,
} from '../../../../../src/modules/transactions/transactions/transactions.types'
import { useControllerApp } from '../../use-controller-app'

// Shared by the use case specs of `TransactionsController` (one file per endpoint): the controller behind the real
// guard and `configureApp` (`useControllerApp`), with a mocked `TransactionsService`.

export { OWNER } from '../../use-controller-app'

export const TRANSACTION_ID = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d'
export const ACCOUNT_ID = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d'
export const CATEGORY_ID = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f'

export const VIEW: TransactionView = {
  id: TRANSACTION_ID,
  accountId: ACCOUNT_ID,
  type: 'expense',
  amount: '1250.5000',
  date: '2026-10-19',
  note: 'Lunch',
  categoryId: CATEGORY_ID,
  transferPairId: null,
  transferDirection: null,
}

/** A page of the list with a next one; the cursor is whatever the service issued, the controller passes it on. */
export const PAGE: TransactionPage = { items: [VIEW], nextCursor: 'eyJvcmRlciI6ImRlc2MifQ' }

/** A create body that passes validation; specs override one field at a time. */
export const VALID_BODY = {
  accountId: ACCOUNT_ID,
  type: 'expense',
  amount: '1250.5',
  date: '2026-10-19',
  categoryId: CATEGORY_ID,
  note: 'Lunch',
}

/** Error body of Nest: `message` is a list for a validation error, a string otherwise. */
export type ErrorBody = { statusCode: number; message: string[] | string }

/**
 * Boots the controller behind the real guard, with a mocked `TransactionsService`. Call it inside a `describe`: it
 * registers the `beforeEach` and `afterEach` for that block.
 */
export const useTransactionsController = () => {
  const transactions = {
    list: vi.fn<TransactionsService['list']>(),
    findOne: vi.fn<TransactionsService['findOne']>(),
    create: vi.fn<TransactionsService['create']>(),
    update: vi.fn<TransactionsService['update']>(),
    remove: vi.fn<TransactionsService['remove']>(),
  }

  beforeEach(() => {
    transactions.list.mockReset().mockResolvedValue(PAGE)
    transactions.findOne.mockReset().mockResolvedValue(VIEW)
    transactions.create.mockReset().mockResolvedValue(VIEW)
    transactions.update.mockReset().mockResolvedValue(VIEW)
    transactions.remove.mockReset().mockResolvedValue()
  })

  return { transactions, ...useControllerApp(TransactionsController, TransactionsService, transactions) }
}
