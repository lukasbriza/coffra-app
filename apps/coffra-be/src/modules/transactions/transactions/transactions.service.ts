import { ConflictException, Inject, Injectable } from '@nestjs/common'

import { omitUndefined, parseIsoDate } from '../../../utils'
import { type Owner, OwnershipService } from '../../core'
import { type Account, isPrismaError, PrismaErrorCode, PrismaService, TransactionType } from '../../prisma'

import { INCOME_EXPENSE_TYPES } from './transactions.constants'
import { toTransactionView } from './transactions.mapper'
import type {
  CreateTransactionInput,
  EditableScope,
  OwnedTransaction,
  TransactionReferences,
  TransactionView,
  UpdateTransactionInput,
} from './transactions.types'

const RESOURCE = 'Transaction'

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OwnershipService) private readonly ownership: OwnershipService,
  ) {}

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
}
