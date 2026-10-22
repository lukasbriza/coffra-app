import type { Account, Transaction, TransferDirection } from '../../prisma'

/**
 * What the API returns for a transfer: both of its transactions as one object. The money leaves `fromAccountId` and
 * arrives to `toAccountId`; `amount` is always positive.
 */
export type TransferView = {
  /** The `transferPairId` of both transactions of the transfer. */
  pairId: string
  fromAccountId: string
  toAccountId: string
  /** Decimal string with four decimal places, in the currency of both accounts, e.g. `"5000.0000"`. */
  amount: string
  /** Calendar day `YYYY-MM-DD`. */
  date: string
  note: string | null
}

export type CreateTransferInput = {
  fromAccountId: string
  toAccountId: string
  /** Positive decimal string. */
  amount: string
  /** Calendar day `YYYY-MM-DD`. */
  date: string
  /** `null` or left out: no note. */
  note?: string | null
}

/** Any field of a create; `null` clears the note. A transfer has no category, so there is none to change. */
export type UpdateTransferInput = Partial<CreateTransferInput>

/** A transaction that is one side of a transfer: it has a pair and a direction (CHECK `transfer_shape`). */
export type TransferSide<Row extends Transaction = Transaction> = Row & {
  transferPairId: string
  transferDirection: TransferDirection
}

/** The two transactions of a transfer by direction: `out` on the source account, `in` on the target. */
export type TransferPair<Row extends Transaction = Transaction> = {
  out: TransferSide<Row>
  in: TransferSide<Row>
}

/** A transaction read with the currency of its account, which a move to another account must keep. */
export type OwnedTransaction = Transaction & { account: Pick<Account, 'currency'> }
