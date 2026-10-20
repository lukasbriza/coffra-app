import { TransactionType } from '../../prisma'

/** The types this API creates and changes. A transfer is a pair of rows with an API of its own. */
export const INCOME_EXPENSE_TYPES = [TransactionType.income, TransactionType.expense] as const
