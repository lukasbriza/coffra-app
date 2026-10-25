import type { AccountType, Prisma, TransactionType, TransferDirection } from '../../prisma'

/**
 * What the API returns for an account.
 *
 * Built by `toAccountView` from a database row, so the owner columns (`userId`, `tenantId`) and the timestamps never
 * leave the service.
 *
 * @property id - id of the account (UUID)
 * @property name - name given by the owner; trimmed, not unique
 * @property type - kind of account: a bank account or cash
 * @property currency - three capital letters, fixed since the account was created
 * @property openingBalance - balance before the first recorded transaction, in the account currency: a decimal string
 * with four decimal places, e.g. `"-1500.2500"`
 * @property balance - balance as of a day, in the account currency: the opening balance plus every transaction up to
 * that day, as a decimal string with four decimal places
 */
export type AccountView = {
  id: string
  name: string
  type: AccountType
  currency: string
  openingBalance: string
  balance: string
}

/**
 * Input of creating an account.
 *
 * @property name - name of the account; trimmed, not unique
 * @property type - kind of account
 * @property currency - three capital letters, fixed from now on: the amounts of the transactions of the account are in
 * it
 * @property openingBalance - balance before the first recorded transaction, a decimal string that may be negative; `0`
 * when left out
 */
export type CreateAccountInput = {
  name: string
  type: AccountType
  currency: string
  openingBalance?: string
}

/** Input of changing an account: any field of a create except `currency`, which never changes. */
export type UpdateAccountInput = Partial<Omit<CreateAccountInput, 'currency'>>

/**
 * The day a balance is counted to.
 *
 * @property asOf - calendar day `YYYY-MM-DD`, inclusive; today (UTC) when left out. Transactions dated later do not
 * count
 */
export type BalanceQuery = {
  asOf?: string
}

/**
 * The sum of the amounts of one kind of transaction of one account, as the database grouped them.
 *
 * @property type - kind of the grouped transactions
 * @property transferDirection - side of a transfer; `null` for income and expense
 * @property total - sum of the amounts, which are always positive: the sign comes from `type` and `transferDirection`
 */
export type BalanceTotal = {
  type: TransactionType
  transferDirection: TransferDirection | null
  total: Prisma.Decimal
}
