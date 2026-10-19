import { beforeEach, vi } from 'vitest'

import { AccountType } from '../../../../../src/modules/prisma'
import { AccountsController } from '../../../../../src/modules/transactions/accounts/accounts.controller'
import { AccountsService } from '../../../../../src/modules/transactions/accounts/accounts.service'
import type { AccountView } from '../../../../../src/modules/transactions/accounts/accounts.types'
import { useControllerApp } from '../../use-controller-app'

// Shared by the use case specs of `AccountsController` (one file per endpoint): the controller behind the real guard
// and `configureApp` (`useControllerApp`), with a mocked `AccountsService`.

export { OWNER } from '../../use-controller-app'

export const ACCOUNT_ID = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d'

export const VIEW: AccountView = {
  id: ACCOUNT_ID,
  name: 'Main account',
  type: AccountType.bank,
  currency: 'CZK',
  openingBalance: '1250.5000',
}

/** A create body that passes validation; specs override one field at a time. */
export const VALID_BODY = { name: 'Main account', type: 'bank', currency: 'CZK', openingBalance: '1250.5' }

/**
 * Boots the controller behind the real guard, with a mocked `AccountsService`. Call it inside a `describe`: it
 * registers the `beforeEach` and `afterEach` for that block.
 */
export const useAccountsController = () => {
  const accounts = {
    list: vi.fn<AccountsService['list']>(),
    findOne: vi.fn<AccountsService['findOne']>(),
    create: vi.fn<AccountsService['create']>(),
    update: vi.fn<AccountsService['update']>(),
    remove: vi.fn<AccountsService['remove']>(),
  }

  beforeEach(() => {
    accounts.list.mockReset().mockResolvedValue([VIEW])
    accounts.findOne.mockReset().mockResolvedValue(VIEW)
    accounts.create.mockReset().mockResolvedValue(VIEW)
    accounts.update.mockReset().mockResolvedValue(VIEW)
    accounts.remove.mockReset().mockResolvedValue()
  })

  return { accounts, ...useControllerApp(AccountsController, AccountsService, accounts) }
}
