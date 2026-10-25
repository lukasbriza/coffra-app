import { beforeEach, vi } from 'vitest'

import { TransfersController } from '../../../../../src/modules/transactions/transfers/transfers.controller'
import { TransfersService } from '../../../../../src/modules/transactions/transfers/transfers.service'
import type { TransferView } from '../../../../../src/modules/transactions/transfers/transfers.types'
import { useControllerApp } from '../../use-controller-app'

// Shared by the use case specs of `TransfersController` (one file per endpoint): the controller behind the real guard
// and `configureApp` (`useControllerApp`), with a mocked `TransfersService`.

export { OWNER } from '../../use-controller-app'

export const PAIR_ID = '1f2e3d4c-5b6a-4987-8a6b-5c4d3e2f1a0b'
export const FROM_ACCOUNT_ID = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d'
export const TO_ACCOUNT_ID = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e'
export const CATEGORY_ID = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f'

export const VIEW: TransferView = {
  pairId: PAIR_ID,
  fromAccountId: FROM_ACCOUNT_ID,
  toAccountId: TO_ACCOUNT_ID,
  amount: '5000.0000',
  date: '2026-10-21',
  note: 'Savings',
}

/** A create body that passes validation; specs override one field at a time. */
export const VALID_BODY = {
  fromAccountId: FROM_ACCOUNT_ID,
  toAccountId: TO_ACCOUNT_ID,
  amount: '5000',
  date: '2026-10-21',
  note: 'Savings',
}

/** Error body of Nest: `message` is a list for a validation error, a string otherwise. */
export type ErrorBody = { statusCode: number; message: string[] | string }

/**
 * Boots the controller behind the real guard, with a mocked `TransfersService`. Call it inside a `describe`: it
 * registers the `beforeEach` and `afterEach` for that block.
 */
export const useTransfersController = () => {
  const transfers = {
    create: vi.fn<TransfersService['create']>(),
    update: vi.fn<TransfersService['update']>(),
    remove: vi.fn<TransfersService['remove']>(),
  }

  beforeEach(() => {
    transfers.create.mockReset().mockResolvedValue(VIEW)
    transfers.update.mockReset().mockResolvedValue(VIEW)
    transfers.remove.mockReset().mockResolvedValue()
  })

  return { transfers, ...useControllerApp(TransfersController, TransfersService, transfers) }
}
