import type { AccountType } from '../../prisma'

/** What the API returns for an account: no owner columns (`userId`, `tenantId`), no timestamps. */
export type AccountView = {
  id: string
  name: string
  type: AccountType
  currency: string
  /** Decimal string with four decimal places, e.g. `"-1500.2500"`. */
  openingBalance: string
}

export type CreateAccountInput = {
  name: string
  type: AccountType
  currency: string
  /** Decimal string; the column default (`0`) applies when it is left out. */
  openingBalance?: string
}

/** The currency is set when the account is created and never changes: the amounts of its transactions are in it. */
export type UpdateAccountInput = Partial<Omit<CreateAccountInput, 'currency'>>
