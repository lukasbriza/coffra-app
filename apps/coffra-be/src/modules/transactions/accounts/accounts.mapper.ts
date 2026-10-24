import type { Account, Prisma } from '../../prisma'
import { formatMoney } from '../common/format-money'

import type { AccountView } from './accounts.types'

/**
 * The only way an account row leaves the service.
 *
 * Only the listed fields are copied, so the owner columns (`userId`, `tenantId`) and the timestamps never reach the
 * API. Amounts become decimal strings with four decimal places. The balance is not a column: the caller computes it.
 *
 * @param row - the account as stored
 * @param balance - the balance of the account as of the day asked for
 * @returns the account as the API shows it
 */
export const toAccountView = (
  { id, name, type, currency, openingBalance }: Account,
  balance: Prisma.Decimal,
): AccountView => ({
  id,
  name,
  type,
  currency,
  openingBalance: formatMoney(openingBalance),
  balance: formatMoney(balance),
})
