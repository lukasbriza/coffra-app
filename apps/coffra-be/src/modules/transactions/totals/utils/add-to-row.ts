import { TransactionType } from '../../../prisma'
import type { CategoryTotal, GroupedTotal } from '../totals.types'

/**
 * Adds the sum of a group to the right side of a row: income to `income`, expense to `expense`.
 *
 * Changes `row`. The addition runs in `Money`, so the result is exact even for a sum of many large amounts.
 *
 * @param row - the row to add to
 * @param group - the group whose `type` says the side and whose `total` says the amount
 * @throws Error for a transfer: the query leaves transfers out, so one here is a broken invariant
 */
export const addToRow = (
  row: Pick<CategoryTotal, 'income' | 'expense'>,
  { type, total }: Pick<GroupedTotal, 'type' | 'total'>,
): void => {
  switch (type) {
    case TransactionType.income: {
      row.income = row.income.plus(total)
      break
    }
    case TransactionType.expense: {
      row.expense = row.expense.plus(total)
      break
    }
    case TransactionType.transfer: {
      throw new Error('A group of transactions is a transfer')
    }
  }
}
