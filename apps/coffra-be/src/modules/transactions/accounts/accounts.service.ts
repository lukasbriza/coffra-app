import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'

import { formatIsoDate, omitUndefined, parseIsoDate } from '../../../utils'
import { type Owner, OwnershipService } from '../../core'
import { type Account, isPrismaError, PrismaErrorCode, PrismaService } from '../../prisma'

import { balanceOf } from './accounts.balance'
import { toAccountView } from './accounts.mapper'
import type { AccountView, BalanceQuery, BalanceTotal, CreateAccountInput, UpdateAccountInput } from './accounts.types'

/** Name of the resource in the `404 Account not found` answer. */
const RESOURCE = 'Account'

/**
 * The accounts of one owner: reads, writes and the balance of each account.
 *
 * Every query on `account` and `transaction` carries the owner scope, so an account of somebody else is never found
 * and ends the same way as a missing one (`404 Account not found`).
 */
@Injectable()
export class AccountsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OwnershipService) private readonly ownership: OwnershipService,
  ) {}

  /**
   * Lists the accounts of the owner with their balances.
   *
   * Ordered by name, then by id: names are not unique and the order has to stay stable. The balances come from one
   * aggregation for all the accounts, however many there are.
   *
   * @param owner - whose accounts to list
   * @param query - the day the balances are counted to
   * @returns the accounts with their balances; empty when the owner has none
   */
  async list(owner: Owner, { asOf }: BalanceQuery): Promise<AccountView[]> {
    const rows = await this.prisma.account.findMany({
      where: this.ownership.scope(owner),
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    })
    const totals = await this.totals(
      owner,
      rows.map(({ id }) => id),
      asOf,
    )

    return rows.map((row) => toAccountView(row, balanceOf(row.openingBalance, totals.get(row.id) ?? [])))
  }

  /**
   * Reads one account of the owner with its balance.
   *
   * @param owner - whose account it has to be
   * @param id - id of the account
   * @param query - the day the balance is counted to
   * @returns the account with its balance
   * @throws NotFoundException when the id is not an account of the owner (a missing and a foreign one look alike)
   */
  async findOne(owner: Owner, id: string, { asOf }: BalanceQuery): Promise<AccountView> {
    const row = await this.findOwned(owner, id)

    return this.withBalance(owner, row, asOf)
  }

  /**
   * Creates an account of the owner.
   *
   * A new account has no transactions, so its balance is its opening balance and nothing is aggregated.
   *
   * @param owner - whom the account will belong to
   * @param input - name, type, currency and optionally the opening balance
   * @returns the new account
   * @throws UnauthorizedException when the owner no longer exists: the user was deleted while the access token was still
   * valid, which `GET /api/users/me` and a refresh answer the same way
   */
  async create(owner: Owner, { name, type, currency, openingBalance }: CreateAccountInput): Promise<AccountView> {
    try {
      const row = await this.prisma.account.create({
        data: { name, type, currency, ...omitUndefined({ openingBalance }), ...this.ownership.ownerData(owner) },
      })

      return toAccountView(row, row.openingBalance)
    } catch (error) {
      // The owner is the only foreign key of an account.
      if (isPrismaError(error, PrismaErrorCode.ForeignKeyViolation)) {
        throw new UnauthorizedException('Invalid or expired access token')
      }

      throw error
    }
  }

  /**
   * Changes an account of the owner.
   *
   * The currency is not in the input: it is set on create only. The balance in the answer is the one of today and is
   * read after the write, because a changed opening balance moves it over the whole history.
   *
   * @param owner - whose account it has to be
   * @param id - id of the account
   * @param input - the fields to change; a field left out stays as it is
   * @returns the changed account
   * @throws NotFoundException when the id is not an account of the owner, or the account was deleted meanwhile
   */
  async update(owner: Owner, id: string, { name, type, openingBalance }: UpdateAccountInput): Promise<AccountView> {
    await this.findOwned(owner, id)

    try {
      const row = await this.prisma.account.update({
        where: { id, ...this.ownership.scope(owner) },
        data: omitUndefined({ name, type, openingBalance }),
      })

      return await this.withBalance(owner, row)
    } catch (error) {
      this.throwIfGone(error)
      throw error
    }
  }

  /**
   * Deletes an account of the owner that has no transactions.
   *
   * The database decides whether it has any (`Restrict` on the transactions), not a count made beforehand, so a
   * transaction created a moment ago cannot slip through a check made before the delete.
   *
   * @param owner - whose account it has to be
   * @param id - id of the account
   * @throws NotFoundException when the id is not an account of the owner
   * @throws ConflictException when the account has transactions
   */
  async remove(owner: Owner, id: string): Promise<void> {
    await this.findOwned(owner, id)

    try {
      await this.prisma.account.delete({ where: { id, ...this.ownership.scope(owner) } })
    } catch (error) {
      if (isPrismaError(error, PrismaErrorCode.ForeignKeyViolation)) {
        throw new ConflictException('Account has transactions and cannot be deleted')
      }

      this.throwIfGone(error)
      throw error
    }
  }

  /**
   * Reads an account within the rows of the owner.
   *
   * @param owner - whose account it has to be
   * @param id - id of the account
   * @returns the stored row
   * @throws NotFoundException when the id is not an account of the owner
   */
  private async findOwned(owner: Owner, id: string): Promise<Account> {
    const row = await this.prisma.account.findFirst({ where: { id, ...this.ownership.scope(owner) } })

    return this.ownership.orNotFound(row, RESOURCE)
  }

  /**
   * Pairs an account row with its balance as of a day.
   *
   * @param owner - whose transactions to add up
   * @param row - the account
   * @param asOf - the day the balance is counted to; today (UTC) when left out
   * @returns the account as the API shows it
   */
  private async withBalance(owner: Owner, row: Account, asOf?: string): Promise<AccountView> {
    const totals = await this.totals(owner, [row.id], asOf)

    return toAccountView(row, balanceOf(row.openingBalance, totals.get(row.id) ?? []))
  }

  /**
   * Adds up the transactions of the given accounts in the database, without loading rows.
   *
   * One query grouped by account, type and direction, counting up to `asOf` inclusive. The owner scope stays in the
   * filter; the ids only narrow the query, which keeps the plan of the database on the index of the accounts.
   *
   * @param owner - whose transactions to add up
   * @param accountIds - the accounts to add up; none means no query
   * @param asOf - the day to count to; today (UTC) when left out
   * @returns the totals by account id; an account without transactions has no entry
   * @throws Error when a group has a null sum: a group exists for at least one row and `amount` is never null
   */
  private async totals(
    owner: Owner,
    accountIds: string[],
    asOf: string | undefined,
  ): Promise<Map<string, BalanceTotal[]>> {
    const totals = new Map<string, BalanceTotal[]>()

    if (accountIds.length === 0) {
      return totals
    }

    const groups = await this.prisma.transaction.groupBy({
      by: ['accountId', 'type', 'transferDirection'],
      where: {
        account: this.ownership.scope(owner),
        accountId: { in: accountIds },
        // `DATE` column and midnight UTC of the day: the day itself counts, a later one does not.
        date: { lte: parseIsoDate(asOf ?? formatIsoDate(new Date())) },
      },
      _sum: { amount: true },
    })

    for (const { accountId, type, transferDirection, _sum } of groups) {
      if (_sum.amount === null) {
        throw new Error('The sum of a group of transactions is null')
      }

      totals.set(accountId, [...(totals.get(accountId) ?? []), { type, transferDirection, total: _sum.amount }])
    }

    return totals
  }

  /**
   * Turns "the row is gone" into the same 404 as an account that never existed.
   *
   * It happens when the account is deleted between the scoped read and the write.
   *
   * @param error - whatever the write threw
   * @throws NotFoundException when `error` is Prisma's record-not-found
   */
  private throwIfGone(error: unknown): void {
    if (isPrismaError(error, PrismaErrorCode.RecordNotFound)) {
      this.ownership.orNotFound(null, RESOURCE)
    }
  }
}
