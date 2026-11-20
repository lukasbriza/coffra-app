import { Inject, Injectable } from '@nestjs/common'

import { type Owner, OwnerDataEraser, type OwnerDataEraserInterface, OwnershipService } from '../../core'
import type { Prisma } from '../../prisma'

/**
 * Erases the transactions, accounts and categories of an owner when their user is deleted.
 *
 * Found by the deletion of `core` through `@OwnerDataEraser()`. It writes only through the transaction it is handed (it
 * does not inject `PrismaService`), so it cannot step outside the deletion, and every query carries the owner scope.
 * The `Restrict` of both foreign keys of a transaction stays: the transactions go first, then what they refer to.
 */
@Injectable()
@OwnerDataEraser()
export class TransactionsDataEraser implements OwnerDataEraserInterface {
  constructor(@Inject(OwnershipService) private readonly ownership: OwnershipService) {}

  /**
   * Deletes every transaction, account and category of the owner, transfers included (both of their sides are on
   * accounts of the owner).
   *
   * @param owner - whose data to erase
   * @param tx - the client of the database transaction that deletes the user
   * @returns when the rows are gone
   */
  async eraseOwnerData(owner: Owner, tx: Prisma.TransactionClient): Promise<void> {
    const scope = this.ownership.scope(owner)

    // Both foreign keys of a transaction are `Restrict`: transactions go first, then what they refer to.
    await tx.transaction.deleteMany({ where: { account: scope } })
    await tx.account.deleteMany({ where: scope })
    await tx.category.deleteMany({ where: scope })
  }
}
