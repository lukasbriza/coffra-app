import { Prisma, TransactionType, TransferDirection } from '../../prisma'

import type { BalanceTotal } from './accounts.types'
import { BALANCE_PRECISION } from './constants'

/** Decimal arithmetic with `BALANCE_PRECISION` significant digits, so a sum of many large amounts stays exact. */
const Money = Prisma.Decimal.clone({ precision: BALANCE_PRECISION })

/**
 * Tells whether a kind of transaction adds to the balance or takes from it.
 *
 * @param total - the grouped total; only `type` and `transferDirection` are read
 * @returns `1` for income and incoming transfers, `-1` for expenses and outgoing transfers
 * @throws Error for a transfer without a direction: the database refuses such a row, so it is a broken invariant and
 * not a client error
 */
const signOf = ({ type, transferDirection }: BalanceTotal): 1 | -1 => {
  switch (type) {
    case TransactionType.income: {
      return 1
    }
    case TransactionType.expense: {
      return -1
    }
    case TransactionType.transfer: {
      if (transferDirection === TransferDirection.in) {
        return 1
      }

      if (transferDirection === TransferDirection.out) {
        return -1
      }

      throw new Error('A transfer total has no direction')
    }
  }
}

/**
 * Computes the balance of an account.
 *
 * The opening balance plus income and incoming transfers, minus expenses and outgoing transfers. The opening balance
 * is not a transaction: it is counted once and never as income.
 *
 * @param openingBalance - balance before the first recorded transaction
 * @param totals - sums grouped by type and direction, in any order; empty for an account without transactions
 * @returns the balance, exact up to `BALANCE_PRECISION` significant digits; may be negative
 * @throws Error when a transfer total has no direction
 */
export const balanceOf = (openingBalance: Prisma.Decimal, totals: readonly BalanceTotal[]): Prisma.Decimal => {
  let balance: Prisma.Decimal = new Money(openingBalance)

  for (const total of totals) {
    balance = signOf(total) === 1 ? balance.plus(total.total) : balance.minus(total.total)
  }

  return balance
}
