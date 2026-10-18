import type { Account } from '../../prisma'
import { formatMoney } from '../common/format-money'

import type { AccountView } from './accounts.types'

/**
 * The only way an account row leaves the service: the listed fields, nothing else, so the owner columns (`userId`,
 * `tenantId`) and the timestamps never reach the API. Amounts become decimal strings with four decimal places.
 */
export const toAccountView = ({ id, name, type, currency, openingBalance }: Account): AccountView => ({
  id,
  name,
  type,
  currency,
  openingBalance: formatMoney(openingBalance),
})
