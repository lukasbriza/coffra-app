import { Inject, Injectable } from '@nestjs/common'

import { formatIsoDate, parseIsoDate } from '../../../utils'
import { type Owner, OwnershipService } from '../../core'
import { type Prisma, PrismaService } from '../../prisma'
import { INCOME_EXPENSE_TYPES } from '../transactions/constants'

import type { CategoryTotal, DailyGroupedTotal, DayTotal, GroupedTotal, TotalsRange } from './totals.types'
import { foldDays } from './utils/fold-days'
import { foldGroups } from './utils/fold-groups'

/**
 * The totals of the income and the expense of one owner, for the domains that show them.
 *
 * Every query carries the owner scope, so a row of somebody else is never counted and never named. The service does
 * not know what "now" is: the caller says which days to add up.
 */
@Injectable()
export class TransactionTotalsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OwnershipService) private readonly ownership: OwnershipService,
  ) {}

  /**
   * Adds up the income and the expense of the owner over a range of days, by currency and category.
   *
   * Transfers are left out and so is the opening balance of an account (it is not a transaction). A transaction dated
   * in the future counts when its day is in the range: the range decides, not today. The amounts of two accounts in the
   * same currency are added, nothing is converted between currencies.
   *
   * It works in three steps: the database adds up the amounts per account, category and type; then the currency of
   * each account and the name of each category are read; then `foldGroups` merges the accounts of one currency.
   *
   * @param owner - whose transactions to add up
   * @param range - the first and the last day, both inclusive
   * @returns one row per currency and category, ordered by currency, then by category name, the rows without a category
   * last; empty when nothing falls in the range
   * @throws Error when the data breaks an invariant (a null sum, a transaction on an account or a category the owner
   * does not have): that is a fault, not a client error
   */
  async categoryTotals(owner: Owner, { from, to }: TotalsRange): Promise<CategoryTotal[]> {
    // 1. Let the database add up the amounts: one sum per account, category and kind (income or expense).
    const groups = await this.groupTotals(owner, from, to)

    // 2. Nothing in the range: there is nothing more to read.
    if (groups.length === 0) {
      return []
    }

    // 3. Collect the accounts and the categories the sums refer to, each id once.
    const accountIds = new Set<string>()
    const categoryIds = new Set<string>()

    for (const { accountId, categoryId } of groups) {
      accountIds.add(accountId)

      // Transactions without a category have no category to read.
      if (categoryId !== null) {
        categoryIds.add(categoryId)
      }
    }

    // 4. Read the currencies and the names. They do not depend on each other, so both are read at once. This comes
    // after the sums on purpose: an account or a category that has a transaction cannot be deleted, so everything the
    // sums refer to is still there to read.
    const [currencies, categoryNames] = await Promise.all([
      this.readCurrencies(owner, [...accountIds]),
      this.readCategoryNames(owner, [...categoryIds]),
    ])

    // 5. Merge the sums of the accounts that share a currency and a category into one row.
    return foldGroups(groups, currencies, categoryNames)
  }

  /**
   * Adds up the income and the expense of the owner over a range of days, by currency and day.
   *
   * It counts the same transactions as {@link categoryTotals} for the same range: transfers and the opening balance of
   * an account are left out, a transaction dated in the future counts when its day is in the range. A day without a
   * transaction has no row, so the result is sparse. The amounts of two accounts in the same currency are added, nothing
   * is converted between currencies.
   *
   * It works in three steps: the database adds up the amounts per account, type and day; then the currency of each
   * account is read; then `foldDays` merges the accounts of one currency.
   *
   * @param owner - whose transactions to add up
   * @param range - the first and the last day, both inclusive
   * @returns one row per currency and day that has a transaction, ordered by currency, then by day; empty when nothing
   * falls in the range
   * @throws Error when the data breaks an invariant (a null sum, a transaction on an account the owner does not have):
   * that is a fault, not a client error
   */
  async dailyTotals(owner: Owner, { from, to }: TotalsRange): Promise<DayTotal[]> {
    // 1. Let the database add up the amounts: one sum per account, day and kind (income or expense).
    const groups = await this.groupDaily(owner, from, to)

    // 2. Nothing in the range: there is nothing more to read.
    if (groups.length === 0) {
      return []
    }

    // 3. Read the currency of the accounts the sums refer to. This comes after the sums on purpose: an account that has
    // a transaction cannot be deleted, so everything the sums refer to is still there to read.
    const currencies = await this.readCurrencies(owner, [...new Set(groups.map(({ accountId }) => accountId))])

    // 4. Merge the sums of the accounts that share a currency and a day into one row.
    return foldDays(groups, currencies)
  }

  /**
   * Adds up the income and the expense of the owner in the database, without loading rows.
   *
   * One query grouped by account, category and type. The owner scope is in the filter; transfers are out of it by type.
   *
   * @param owner - whose transactions to add up
   * @param from - first day, `YYYY-MM-DD`
   * @param to - last day, `YYYY-MM-DD`
   * @returns the sums by account, category and type; empty when nothing matches
   * @throws Error when a group has a null sum: a group exists for at least one row and `amount` is never null
   */
  private async groupTotals(owner: Owner, from: string, to: string): Promise<GroupedTotal[]> {
    const groups = await this.prisma.transaction.groupBy({
      by: ['accountId', 'categoryId', 'type'],
      where: this.incomeExpenseWhere(owner, from, to),
      _sum: { amount: true },
    })

    return groups.map(({ accountId, categoryId, type, _sum }) => {
      // A group exists for at least one row and an amount is never null, so a null sum is a fault.
      if (_sum.amount === null) {
        throw new Error('The sum of a group of transactions is null')
      }

      return { accountId, categoryId, type, total: _sum.amount }
    })
  }

  /**
   * Adds up the income and the expense of the owner in the database by day, without loading rows.
   *
   * One query grouped by account, type and day. The filter is the one of {@link groupTotals}.
   *
   * @param owner - whose transactions to add up
   * @param from - first day, `YYYY-MM-DD`
   * @param to - last day, `YYYY-MM-DD`
   * @returns the sums by account, type and day; empty when nothing matches
   * @throws Error when a group has a null sum: a group exists for at least one row and `amount` is never null
   */
  private async groupDaily(owner: Owner, from: string, to: string): Promise<DailyGroupedTotal[]> {
    const groups = await this.prisma.transaction.groupBy({
      by: ['accountId', 'type', 'date'],
      where: this.incomeExpenseWhere(owner, from, to),
      _sum: { amount: true },
    })

    return groups.map(({ accountId, type, date, _sum }) => {
      // A group exists for at least one row and an amount is never null, so a null sum is a fault.
      if (_sum.amount === null) {
        throw new Error('The sum of a group of transactions is null')
      }

      // A `DATE` column comes back as midnight UTC of its day, which `formatIsoDate` writes back in UTC.
      return { accountId, date: formatIsoDate(date), type, total: _sum.amount }
    })
  }

  /**
   * The filter of every sum: transactions of the owner that are income or expense and dated in the range.
   *
   * It is written once so that no sum can forget the owner scope or count a transfer.
   *
   * @param owner - whose transactions to match
   * @param from - first day, `YYYY-MM-DD`
   * @param to - last day, `YYYY-MM-DD`
   * @returns the `where` of a query on `Transaction`
   */
  private incomeExpenseWhere(owner: Owner, from: string, to: string): Prisma.TransactionWhereInput {
    return {
      // Only transactions on accounts of the owner.
      account: this.ownership.scope(owner),
      // Only income and expense: a transfer just moves money between accounts.
      type: { in: [...INCOME_EXPENSE_TYPES] },
      // `DATE` column and midnight UTC of both days: `gte` and `lte` keep both whole days.
      date: { gte: parseIsoDate(from), lte: parseIsoDate(to) },
    }
  }

  /**
   * Reads the currency of the given accounts of the owner.
   *
   * @param owner - whose accounts to read; an account of somebody else is not found
   * @param accountIds - ids of the accounts
   * @returns the currency of each account found, by account id
   */
  private async readCurrencies(owner: Owner, accountIds: string[]): Promise<Map<string, string>> {
    const accounts = await this.prisma.account.findMany({
      where: { id: { in: accountIds }, ...this.ownership.scope(owner) },
      select: { id: true, currency: true },
    })

    return new Map(accounts.map(({ id, currency }) => [id, currency]))
  }

  /**
   * Reads the names of the given categories of the owner.
   *
   * A category of somebody else is not found, so its name can never end up in an answer: `foldGroups` fails on a sum
   * that refers to a category missing here.
   *
   * @param owner - whose categories to read
   * @param categoryIds - ids of the categories; none means no query
   * @returns the name of each category found, by category id
   */
  private async readCategoryNames(owner: Owner, categoryIds: string[]): Promise<Map<string, string>> {
    // None of the sums has a category: nothing to read.
    if (categoryIds.length === 0) {
      return new Map()
    }

    const categories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds }, ...this.ownership.scope(owner) },
      select: { id: true, name: true },
    })

    return new Map(categories.map(({ id, name }) => [id, name]))
  }
}
