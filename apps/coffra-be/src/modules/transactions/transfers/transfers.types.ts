import type { Account, Transaction, TransferDirection } from '../../prisma'

/**
 * What the API returns for a transfer: both of its transactions as one object.
 *
 * The money leaves `fromAccountId` and arrives to `toAccountId`; `amount` is always positive.
 *
 * @property pairId - the `transferPairId` of both transactions of the transfer
 * @property fromAccountId - the account the money leaves
 * @property toAccountId - the account the money arrives to
 * @property amount - decimal string with four decimal places, in the currency of both accounts, e.g. `"5000.0000"`
 * @property date - calendar day `YYYY-MM-DD`
 * @property note - free text for both transactions, `null` for none
 */
export type TransferView = {
  pairId: string
  fromAccountId: string
  toAccountId: string
  amount: string
  date: string
  note: string | null
}

/**
 * Input of creating a transfer.
 *
 * @property fromAccountId - the account the money leaves
 * @property toAccountId - the account the money arrives to
 * @property amount - positive decimal string
 * @property date - calendar day `YYYY-MM-DD`
 * @property note - free text; `null` or left out for none
 */
export type CreateTransferInput = {
  fromAccountId: string
  toAccountId: string
  amount: string
  date: string
  note?: string | null
}

/** Input of changing a transfer: any field of a create; `null` clears the note. A transfer has no category. */
export type UpdateTransferInput = Partial<CreateTransferInput>

/**
 * A transaction that is one side of a transfer: it has a pair and a direction (CHECK `transfer_shape`).
 *
 * @property transferPairId - the pair the side belongs to
 * @property transferDirection - `out` on the source account, `in` on the target
 */
export type TransferSide<Row extends Transaction = Transaction> = Row & {
  transferPairId: string
  transferDirection: TransferDirection
}

/**
 * The two transactions of a transfer by direction.
 *
 * @property out - the side on the source account
 * @property in - the side on the target account
 */
export type TransferPair<Row extends Transaction = Transaction> = {
  out: TransferSide<Row>
  in: TransferSide<Row>
}

/** A transaction read with the currency of its account, which a move to another account must keep. */
export type OwnedTransaction = Transaction & { account: Pick<Account, 'currency'> }
