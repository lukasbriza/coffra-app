import { formatIsoDate } from '../../../utils'
import type { Transaction } from '../../prisma'
import { formatMoney } from '../common/format-money'

import type { TransactionView } from './transactions.types'

/**
 * The only way a transaction row leaves the service.
 *
 * Only the listed fields are copied, so the timestamps and whatever a query included (the account) never reach the
 * API. The amount becomes a decimal string with four decimal places, the date a calendar day read in UTC.
 *
 * @param row - the transaction as stored
 * @returns the transaction as the API shows it
 */
export const toTransactionView = ({
  id,
  accountId,
  type,
  amount,
  date,
  note,
  categoryId,
  transferPairId,
  transferDirection,
}: Transaction): TransactionView => ({
  id,
  accountId,
  type,
  amount: formatMoney(amount),
  date: formatIsoDate(date),
  note,
  categoryId,
  transferPairId,
  transferDirection,
})
