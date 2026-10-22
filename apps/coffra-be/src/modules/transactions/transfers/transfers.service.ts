import { randomUUID } from 'node:crypto'

import { ConflictException, Inject, Injectable } from '@nestjs/common'

import { parseIsoDate } from '../../../utils'
import { type Owner, OwnershipService } from '../../core'
import {
  type Account,
  isPrismaError,
  type Prisma,
  PrismaErrorCode,
  PrismaService,
  TransactionType,
  TransferDirection,
} from '../../prisma'

import { toTransferPair, toTransferView } from './transfers.mapper'
import type {
  CreateTransferInput,
  OwnedTransaction,
  TransferPair,
  TransferView,
  UpdateTransferInput,
} from './transfers.types'

const RESOURCE = 'Transfer'

/**
 * A transfer is two transactions, `out` on the source account and `in` on the target, sharing a `transferPairId`.
 * Every write touches both at once, in one statement or one database transaction, so no side is ever left alone. A
 * transfer never has a category.
 */
@Injectable()
export class TransfersService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OwnershipService) private readonly ownership: OwnershipService,
  ) {}

  async create(owner: Owner, input: CreateTransferInput): Promise<TransferView> {
    const { fromAccountId, toAccountId, amount, date, note } = input

    // Both accounts must be accounts of the owner: a foreign or missing one is a 404. They are read at once.
    const [fromAccount, toAccount] = await Promise.all([
      this.findAccount(owner, fromAccountId),
      this.findAccount(owner, toAccountId),
    ])

    // The amount is never converted, so both accounts must have the same currency.
    if (fromAccount.currency !== toAccount.currency) {
      throw new ConflictException('A transfer needs two accounts in the same currency')
    }

    // The two sides share the pair id, the amount and the date. Only the account and the direction differ: `out` leaves
    // the source account, `in` arrives to the target one.
    const transferPairId = randomUUID()
    const day = parseIsoDate(date)

    const outSide: Prisma.TransactionCreateManyInput = {
      accountId: fromAccountId,
      transferDirection: TransferDirection.out,
      type: TransactionType.transfer,
      transferPairId,
      amount,
      date: day,
    }
    const inSide: Prisma.TransactionCreateManyInput = {
      accountId: toAccountId,
      transferDirection: TransferDirection.in,
      type: TransactionType.transfer,
      transferPairId,
      amount,
      date: day,
    }

    // The note is optional. Without one, the column keeps its default: no note.
    if (note !== undefined) {
      outSide.note = note
      inSide.note = note
    }

    try {
      // Both sides in one INSERT. A single SQL statement is atomic: when one side fails, neither is written.
      const rows = await this.prisma.transaction.createManyAndReturn({ data: [outSide, inSide] })

      return toTransferView(toTransferPair(rows))
    } catch (error) {
      // An account was deleted between the read above and the INSERT, so its foreign key failed. Reading the accounts
      // again throws the same 404 the read above would have thrown.
      if (isPrismaError(error, PrismaErrorCode.ForeignKeyViolation)) {
        await this.findAccount(owner, fromAccountId)
        await this.findAccount(owner, toAccountId)
      }

      throw error
    }
  }

  async update(owner: Owner, pairId: string, input: UpdateTransferInput): Promise<TransferView> {
    const { fromAccountId, toAccountId, amount, date, note } = input

    // The stored transfer: a foreign or missing one is a 404.
    const pair = await this.findPair(owner, pairId)

    // The accounts of the transfer after the change: the one from the input, or the one the side has now.
    const newFromAccountId = fromAccountId ?? pair.out.accountId
    const newToAccountId = toAccountId ?? pair.in.accountId

    // The input can be valid on its own and still meet the side that stays: `{ toAccountId: <the current source> }`
    // would move money from an account to itself.
    if (newFromAccountId === newToAccountId) {
      throw new ConflictException('A transfer needs two different accounts')
    }

    // A side moves only when it gets another account than the one it has. An account that stays is not read again.
    const isFromMoved = newFromAccountId !== pair.out.accountId
    const isToMoved = newToAccountId !== pair.in.accountId

    // A new account must be an account of the owner (a 404 otherwise). The two reads run at once.
    const [newFromAccount, newToAccount] = await Promise.all([
      isFromMoved ? this.findAccount(owner, newFromAccountId) : undefined,
      isToMoved ? this.findAccount(owner, newToAccountId) : undefined,
    ])

    // The amount is never converted, so a new account must have the currency of the transfer. Moving both sides to
    // accounts of another common currency is refused too: the same amount would mean something else.
    const transferCurrency = pair.out.account.currency
    const fromHasOtherCurrency = newFromAccount !== undefined && newFromAccount.currency !== transferCurrency
    const toHasOtherCurrency = newToAccount !== undefined && newToAccount.currency !== transferCurrency

    if (fromHasOtherCurrency || toHasOtherCurrency) {
      throw new ConflictException('A transfer cannot move to an account in another currency')
    }

    // What changes. The amount, the date and the note change on both sides alike; a field the input leaves out stays
    // as it is.
    const sharedChanges: Prisma.TransactionUncheckedUpdateInput = {}

    if (amount !== undefined) {
      sharedChanges.amount = amount
    }

    if (date !== undefined) {
      sharedChanges.date = parseIsoDate(date)
    }

    if (note !== undefined) {
      sharedChanges.note = note
    }

    // An account changes on its own side only: the source on `out`, the target on `in`.
    const outChanges: Prisma.TransactionUncheckedUpdateInput = { ...sharedChanges }
    const inChanges: Prisma.TransactionUncheckedUpdateInput = { ...sharedChanges }

    if (isFromMoved) {
      outChanges.accountId = newFromAccountId
    }

    if (isToMoved) {
      inChanges.accountId = newToAccountId
    }

    try {
      // Both sides in one database transaction: when the second UPDATE fails, the first one is rolled back too. Always
      // `out` first: two changes of one transfer at once then lock the rows in the same order, and the second waits for
      // the first instead of deadlocking.
      const rows = await this.prisma.$transaction([
        this.prisma.transaction.update({
          where: this.sideWhere(owner, pairId, TransferDirection.out),
          data: outChanges,
        }),
        this.prisma.transaction.update({ where: this.sideWhere(owner, pairId, TransferDirection.in), data: inChanges }),
      ])

      return toTransferView(toTransferPair(rows))
    } catch (error) {
      // The transfer was deleted between the read at the start and the UPDATE.
      if (isPrismaError(error, PrismaErrorCode.RecordNotFound)) {
        this.throwTransferNotFound()
      }

      // A new account was deleted between its read and the UPDATE, so its foreign key failed. Reading it again throws
      // the same 404 its read would have thrown.
      if (isPrismaError(error, PrismaErrorCode.ForeignKeyViolation)) {
        if (isFromMoved) {
          await this.findAccount(owner, newFromAccountId)
        }

        if (isToMoved) {
          await this.findAccount(owner, newToAccountId)
        }
      }

      throw error
    }
  }

  /** No read before: there is nothing to decide but whether the transfer exists, and the count tells that. */
  async remove(owner: Owner, pairId: string): Promise<void> {
    // One DELETE of both sides: atomic, so no side is ever left alone.
    const { count } = await this.prisma.transaction.deleteMany({
      where: { transferPairId: pairId, account: this.ownership.scope(owner) },
    })

    if (count === 0) {
      this.throwTransferNotFound()
    }
  }

  /**
   * Both sides of the transfer, with the currency of their accounts. A transaction has no owner columns of its own, so
   * it is scoped through its account. Only a transfer has a `transferPairId` (CHECK `transfer_shape`), so the `type`
   * needs no condition.
   */
  private async findPair(owner: Owner, pairId: string): Promise<TransferPair<OwnedTransaction>> {
    const rows = await this.prisma.transaction.findMany({
      where: { transferPairId: pairId, account: this.ownership.scope(owner) },
      include: { account: { select: { currency: true } } },
    })

    if (rows.length === 0) {
      this.throwTransferNotFound()
    }

    return toTransferPair(rows)
  }

  /** One side by the unique `(transferPairId, transferDirection)`, scoped through its account. */
  private sideWhere(
    owner: Owner,
    pairId: string,
    transferDirection: TransferDirection,
  ): Prisma.TransactionWhereUniqueInput {
    return {
      transferPairId_transferDirection: { transferPairId: pairId, transferDirection },
      account: this.ownership.scope(owner),
    }
  }

  /**
   * An account of the owner, with its currency. The read is scoped to the owner, so a foreign account is not found
   * and gives the same 404 as a missing one.
   */
  private async findAccount(owner: Owner, accountId: string): Promise<Pick<Account, 'currency'>> {
    const account = await this.prisma.account.findFirst({
      where: { id: accountId, ...this.ownership.scope(owner) },
      select: { currency: true },
    })

    return this.ownership.orNotFound(account, 'Account')
  }

  /** The 404 of a transfer the owner does not have: a missing transfer and a foreign one look the same. */
  private throwTransferNotFound(): never {
    return this.ownership.orNotFound<never>(null, RESOURCE)
  }
}
