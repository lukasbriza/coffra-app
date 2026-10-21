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

const RESOURCE = 'Transaction'

/**
 * The order of the list. `date` has no time, so many rows tie: `createdAt` orders the rows of one day and `id` makes
 * the order total. A cursor is a position in exactly this order.
 */
const listOrder = (order: ListOrder): Prisma.TransactionOrderByWithRelationInput[] => [
  { date: order },
  { createdAt: order },
  { id: order },
]

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OwnershipService) private readonly ownership: OwnershipService,
  ) {}

  /**
   * One page of the transactions of the owner, both sides of a transfer included. A filter on an account or a category
   * of another owner is one more condition on rows the scope already limits: it matches nothing, like a missing id.
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

  /** Any transaction of the owner, a side of a transfer included: reading one breaks no pair. */
  async findOne(owner: Owner, id: string): Promise<TransactionView> {
    const row = await this.findOwned(owner, id)

    return toTransactionView(row)
  }

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

  async remove(owner: Owner, id: string): Promise<void> {
    await this.findEditable(owner, id)

    try {
      await this.prisma.transaction.delete({ where: { id, ...this.editable(owner) } })
    } catch (error) {
      this.throwIfGone(error)
      throw error
    }
  }

  /** Scoped through the account: a transaction has no owner columns of its own. */
  private async findOwned(owner: Owner, id: string): Promise<OwnedTransaction> {
    const row = await this.prisma.transaction.findFirst({
      where: { id, account: this.ownership.scope(owner) },
      include: { account: { select: { currency: true } } },
    })

    return this.ownership.orNotFound(row, RESOURCE)
  }

  /** A side of a transfer changes only together with its pair, through the transfers API. */
  private async findEditable(owner: Owner, id: string): Promise<OwnedTransaction> {
    const row = await this.findOwned(owner, id)

    if (row.type === TransactionType.transfer) {
      throw new ConflictException('Transaction is part of a transfer and cannot be changed here')
    }

    return row
  }

  /**
   * The `where` of every write: the owner scope through the account, and income or expense only, so not even a write
   * that skipped `findEditable` can touch one side of a transfer pair.
   */
  private editable(owner: Owner): EditableScope {
    return { account: this.ownership.scope(owner), type: { in: [...INCOME_EXPENSE_TYPES] } }
  }

  /**
   * The account and the category the input points to, both read through the owner scope: a foreign one is a 404 like
   * a missing one, and with one owner per request both belong together. The two reads run at once; the account is
   * checked first, so the answer never depends on which query returns first. Returns the account, when there is one.
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
   * A foreign key failed: the account or the category was deleted between the check and the write. Reading them
   * again gives the 404 the check would have given; when both are still there, the error is something else.
   */
  private async throwIfReferenceGone(owner: Owner, error: unknown, references: TransactionReferences): Promise<void> {
    if (isPrismaError(error, PrismaErrorCode.ForeignKeyViolation)) {
      await this.resolveReferences(owner, references)
    }
  }

  /** The row was deleted between the scoped read and the write: the same 404 as a transaction that never existed. */
  private throwIfGone(error: unknown): void {
    if (isPrismaError(error, PrismaErrorCode.RecordNotFound)) {
      this.ownership.orNotFound(null, RESOURCE)
    }
  }

  /**
   * Both ends inclusive. Only because the column is a `DATE`: it compares with midnight UTC of the day
   * (`parseIsoDate`), so `lte` keeps the whole day `to`; on a timestamp it would drop all of it but midnight.
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
   * The rows beyond the cursor in its order: `(date, createdAt, id)` after the one of the cursor, spelled out because
   * Prisma has no comparison of row values. The bound on `date` alone adds nothing to the result but gives the planner
   * a range on the date. In `AND`, so it never replaces the `from`/`to` filter, which sits on `date` too.
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
