import { ConflictException, Inject, Injectable } from '@nestjs/common'

import { omitUndefined, parseIsoDate } from '../../../utils'
import { type Owner, OwnershipService } from '../../core'
import { type Account, isPrismaError, type Prisma, PrismaErrorCode, PrismaService, TransactionType } from '../../prisma'

import { INCOME_EXPENSE_TYPES } from './constants'
import { encodeListCursor } from './transactions.cursor'
import { toTransactionView } from './transactions.mapper'
import type {
  CreateTransactionInput,
  DateRange,
  EditableScope,
  ListCursor,
  ListOrder,
  ListTransactionsInput,
  OwnedTransaction,
  TransactionPage,
  TransactionReferences,
  TransactionView,
  UpdateTransactionInput,
} from './transactions.types'

/** Name of the resource in the `404 Transaction not found` answer. */
const RESOURCE = 'Transaction'

/**
 * The order of the list over `(date, createdAt, id)`.
 *
 * `date` has no time, so many rows tie: `createdAt` orders the rows of one day and `id` makes the order total. A
 * cursor is a position in exactly this order.
 *
 * @param order - `desc` or `asc`, applied to all three keys
 * @returns the Prisma `orderBy`
 */
const listOrder = (order: ListOrder): Prisma.TransactionOrderByWithRelationInput[] => [
  { date: order },
  { createdAt: order },
  { id: order },
]

/**
 * The income and the expense of one owner, and the list of every transaction including the sides of a transfer.
 *
 * Every query carries the owner scope through the account, so a transaction of somebody else is never found and ends
 * the same way as a missing one (`404 Transaction not found`). A side of a transfer is readable here but changes only
 * through the transfers.
 */
@Injectable()
export class TransactionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OwnershipService) private readonly ownership: OwnershipService,
  ) {}

  /**
   * Lists one page of the transactions of the owner, both sides of a transfer included.
   *
   * A filter on an account or a category of another owner is one more condition on rows the scope already limits: it
   * matches nothing, like a missing id.
   *
   * @param owner - whose transactions to list
   * @param input - the filters, the order, the size of the page and the cursor of the previous one
   * @returns the page and the cursor of the next one, `null` on the last page
   */
  async list(
    owner: Owner,
    { accountId, categoryId, type, from, to, order, limit, cursor }: ListTransactionsInput,
  ): Promise<TransactionPage> {
    const rows = await this.prisma.transaction.findMany({
      where: {
        account: this.ownership.scope(owner),
        ...omitUndefined({ accountId, categoryId, type, date: this.dateRange(from, to) }),
        ...(cursor === undefined ? {} : this.beyond(cursor)),
      },
      orderBy: listOrder(order),
      // One row more than the page: whether it comes says whether there is a next page.
      take: limit + 1,
    })

    const page = rows.slice(0, limit)
    const last = page.at(-1)

    return {
      items: page.map(toTransactionView),
      nextCursor: rows.length > limit && last !== undefined ? encodeListCursor(last, order) : null,
    }
  }

  /**
   * Reads any transaction of the owner, a side of a transfer included: reading one breaks no pair.
   *
   * @param owner - whose transaction it has to be
   * @param id - id of the transaction
   * @returns the transaction
   * @throws NotFoundException when the id is not a transaction of the owner
   */
  async findOne(owner: Owner, id: string): Promise<TransactionView> {
    const row = await this.findOwned(owner, id)

    return toTransactionView(row)
  }

  /**
   * Records an income or an expense on an account of the owner.
   *
   * The account and the category are read through the owner scope before the write, because the database cannot tell
   * whose they are.
   *
   * @param owner - whose account and category the transaction may use
   * @param input - account, type, amount, date, and optionally category and note
   * @returns the new transaction
   * @throws NotFoundException when the account or the category is not among those of the owner
   */
  async create(
    owner: Owner,
    { accountId, type, amount, date, categoryId, note }: CreateTransactionInput,
  ): Promise<TransactionView> {
    const references = { accountId, categoryId }
    await this.resolveReferences(owner, references)

    try {
      const row = await this.prisma.transaction.create({
        data: { accountId, type, amount, date: parseIsoDate(date), ...omitUndefined({ categoryId, note }) },
      })

      return toTransactionView(row)
    } catch (error) {
      await this.throwIfReferenceGone(owner, error, references)
      throw error
    }
  }

  /**
   * Changes an income or an expense of the owner.
   *
   * A move to another account needs an account of the same currency, because the amount is never converted.
   *
   * @param owner - whose transaction, account and category they have to be
   * @param id - id of the transaction
   * @param input - the fields to change; a field left out stays as it is
   * @returns the changed transaction
   * @throws NotFoundException when the transaction, the account or the category is not among those of the owner
   * @throws ConflictException when the transaction is a side of a transfer, or the new account has another currency
   */
  async update(
    owner: Owner,
    id: string,
    { accountId, type, amount, date, categoryId, note }: UpdateTransactionInput,
  ): Promise<TransactionView> {
    const current = await this.findEditable(owner, id)
    // The account it already has is no move: nothing to read, nothing to compare.
    const isMove = accountId !== undefined && accountId !== current.accountId
    const references = { accountId: isMove ? accountId : undefined, categoryId }
    const target = await this.resolveReferences(owner, references)

    // The amount is in the currency of the account, and nothing converts it.
    if (target !== undefined && target.currency !== current.account.currency) {
      throw new ConflictException('A transaction cannot move to an account in another currency')
    }

    try {
      const row = await this.prisma.transaction.update({
        where: { id, ...this.editable(owner) },
        data: omitUndefined({
          accountId,
          type,
          amount,
          date: date === undefined ? undefined : parseIsoDate(date),
          categoryId,
          note,
        }),
      })

      return toTransactionView(row)
    } catch (error) {
      this.throwIfGone(error)
      await this.throwIfReferenceGone(owner, error, references)
      throw error
    }
  }

  /**
   * Deletes an income or an expense of the owner.
   *
   * @param owner - whose transaction it has to be
   * @param id - id of the transaction
   * @throws NotFoundException when the id is not a transaction of the owner, or it was deleted meanwhile
   * @throws ConflictException when the transaction is a side of a transfer
   */
  async remove(owner: Owner, id: string): Promise<void> {
    await this.findEditable(owner, id)

    try {
      await this.prisma.transaction.delete({ where: { id, ...this.editable(owner) } })
    } catch (error) {
      this.throwIfGone(error)
      throw error
    }
  }

  /**
   * Reads a transaction within the rows of the owner, with the currency of its account.
   *
   * Scoped through the account: a transaction has no owner columns of its own.
   *
   * @param owner - whose transaction it has to be
   * @param id - id of the transaction
   * @returns the stored row with its account's currency
   * @throws NotFoundException when the id is not a transaction of the owner
   */
  private async findOwned(owner: Owner, id: string): Promise<OwnedTransaction> {
    const row = await this.prisma.transaction.findFirst({
      where: { id, account: this.ownership.scope(owner) },
      include: { account: { select: { currency: true } } },
    })

    return this.ownership.orNotFound(row, RESOURCE)
  }

  /**
   * Reads a transaction of the owner that may be changed: an income or an expense.
   *
   * A side of a transfer changes only together with its pair, through the transfers API.
   *
   * @param owner - whose transaction it has to be
   * @param id - id of the transaction
   * @returns the stored row with its account's currency
   * @throws NotFoundException when the id is not a transaction of the owner
   * @throws ConflictException when the transaction is a side of a transfer
   */
  private async findEditable(owner: Owner, id: string): Promise<OwnedTransaction> {
    const row = await this.findOwned(owner, id)

    if (row.type === TransactionType.transfer) {
      throw new ConflictException('Transaction is part of a transfer and cannot be changed here')
    }

    return row
  }

  /**
   * Builds the `where` of every write: the owner scope through the account, and income or expense only.
   *
   * So not even a write that skipped `findEditable` can touch one side of a transfer pair.
   *
   * @param owner - whose transactions the write may touch
   * @returns the `where` fragment
   */
  private editable(owner: Owner): EditableScope {
    return { account: this.ownership.scope(owner), type: { in: [...INCOME_EXPENSE_TYPES] } }
  }

  /**
   * Reads the account and the category an input points to, both through the owner scope.
   *
   * A foreign one is a 404 like a missing one, and with one owner per request both belong together. The two reads run
   * at once; the account is checked first, so the answer never depends on which query returns first.
   *
   * @param owner - whose account and category they have to be
   * @param references - the account and the category to read, each left out when there is nothing to check
   * @returns the currency of the account, when one was asked for
   * @throws NotFoundException when the account or the category is not among those of the owner
   */
  private async resolveReferences(
    owner: Owner,
    { accountId, categoryId }: TransactionReferences,
  ): Promise<Pick<Account, 'currency'> | undefined> {
    const scope = this.ownership.scope(owner)
    const [account, category] = await Promise.all([
      accountId === undefined
        ? undefined
        : this.prisma.account.findFirst({ where: { id: accountId, ...scope }, select: { currency: true } }),
      categoryId === undefined || categoryId === null
        ? undefined
        : this.prisma.category.findFirst({ where: { id: categoryId, ...scope }, select: { id: true } }),
    ])

    // `undefined` was not asked for and passes; `null` was not found.
    const target = this.ownership.orNotFound(account, 'Account')
    this.ownership.orNotFound(category, 'Category')

    return target
  }

  /**
   * Turns a foreign key failure into the 404 it stands for.
   *
   * The account or the category was deleted between the check and the write. Reading them again gives the 404 the
   * check would have given; when both are still there, the error is something else.
   *
   * @param owner - whose account and category they have to be
   * @param error - whatever the write threw
   * @param references - the account and the category the write pointed to
   * @throws NotFoundException when one of them is gone
   */
  private async throwIfReferenceGone(owner: Owner, error: unknown, references: TransactionReferences): Promise<void> {
    if (isPrismaError(error, PrismaErrorCode.ForeignKeyViolation)) {
      await this.resolveReferences(owner, references)
    }
  }

  /**
   * Turns "the row is gone" into the same 404 as a transaction that never existed.
   *
   * It happens when the transaction is deleted between the scoped read and the write.
   *
   * @param error - whatever the write threw
   * @throws NotFoundException when `error` is Prisma's record-not-found
   */
  private throwIfGone(error: unknown): void {
    if (isPrismaError(error, PrismaErrorCode.RecordNotFound)) {
      this.ownership.orNotFound(null, RESOURCE)
    }
  }

  /**
   * Builds the filter of a range of days, both ends inclusive.
   *
   * Inclusive only because the column is a `DATE`: it compares with midnight UTC of the day (`parseIsoDate`), so `lte`
   * keeps the whole day `to`; on a timestamp it would drop all of it but midnight.
   *
   * @param from - first day `YYYY-MM-DD`, left out for an open start
   * @param to - last day `YYYY-MM-DD`, left out for an open end
   * @returns the filter, `undefined` when both ends are open
   */
  private dateRange(from: string | undefined, to: string | undefined): DateRange | undefined {
    if (from === undefined && to === undefined) {
      return undefined
    }

    return omitUndefined({
      gte: from === undefined ? undefined : parseIsoDate(from),
      lte: to === undefined ? undefined : parseIsoDate(to),
    })
  }

  /**
   * Builds the filter of the rows beyond the cursor in its order: `(date, createdAt, id)` after the one of the cursor.
   *
   * Spelled out because Prisma has no comparison of row values. The bound on `date` alone adds nothing to the result
   * but gives the planner a range on the date. It sits in `AND`, so it never replaces the `from`/`to` filter, which is
   * on `date` too.
   *
   * @param cursor - the position after the last row of the previous page
   * @returns the `where` fragment
   */
  private beyond({ order, date, createdAt, id }: ListCursor): Prisma.TransactionWhereInput {
    const day = parseIsoDate(date)
    const at = new Date(createdAt)

    if (order === 'desc') {
      return {
        AND: [
          { date: { lte: day } },
          { OR: [{ date: { lt: day } }, { createdAt: { lt: at } }, { createdAt: at, id: { lt: id } }] },
        ],
      }
    }

    return {
      AND: [
        { date: { gte: day } },
        { OR: [{ date: { gt: day } }, { createdAt: { gt: at } }, { createdAt: at, id: { gt: id } }] },
      ],
    }
  }
}
