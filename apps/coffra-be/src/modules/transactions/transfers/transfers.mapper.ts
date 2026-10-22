import { formatIsoDate } from '../../../utils'
import { type Transaction, TransferDirection } from '../../prisma'
import { formatMoney } from '../common/format-money'

import type { TransferPair, TransferSide, TransferView } from './transfers.types'

const isSide =
  <Row extends Transaction>(direction: TransferDirection) =>
  (row: Row): row is TransferSide<Row> =>
    row.transferDirection === direction && row.transferPairId !== null

/**
 * The two transactions of one transfer by direction, in whatever order they came. Anything but one `out` and one `in`
 * of the same pair is a broken pair: the API never leaves one (both sides are written in one statement or one database
 * transaction), so it is an error of the data, a 500, never a 404 for the client.
 */
export const toTransferPair = <Row extends Transaction>(rows: Row[]): TransferPair<Row> => {
  const out = rows.find(isSide<Row>(TransferDirection.out))
  const incoming = rows.find(isSide<Row>(TransferDirection.in))

  // Two rows, one of them `out` and one `in` of the same pair: exactly one of each. A missing `in` fails the comparison.
  if (rows.length !== 2 || out === undefined || out.transferPairId !== incoming?.transferPairId) {
    throw new Error(`Broken transfer: ${rows.length} transaction(s) instead of one out and one in of the same pair`)
  }

  return { out, in: incoming }
}

/**
 * The only way a transfer leaves the service: the pair as one object, the listed fields only. Amount, date and note
 * are the same on both sides (every write sets them on both), so they are read from `out`.
 */
export const toTransferView = ({ out, in: incoming }: TransferPair): TransferView => ({
  pairId: out.transferPairId,
  fromAccountId: out.accountId,
  toAccountId: incoming.accountId,
  amount: formatMoney(out.amount),
  date: formatIsoDate(out.date),
  note: out.note,
})
