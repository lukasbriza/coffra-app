import { Injectable, NotFoundException } from '@nestjs/common'

import type { Owner, OwnerData, OwnerScope } from './ownership.types'

/**
 * The one place that decides whose rows a query sees and who owns a new row. It runs no query itself: the caller
 * spreads the scope into its own query, so a row of another owner is never found and ends the same way as a row
 * that does not exist.
 */
@Injectable()
export class OwnershipService {
  /**
   * Spread into the `where` of every query on a model that carries the owner columns. A model without them is
   * scoped through the relation to its parent, e.g. `{ account: ownership.scope(owner) }`.
   */
  scope(owner: Owner): OwnerScope {
    return { userId: owner.userId }
  }

  /** Spread into the `data` of a create on a model that carries the owner columns. */
  ownerData(owner: Owner): OwnerData {
    return { userId: owner.userId }
  }

  /**
   * The row a scoped query found, or the 404 of the resource (`resource` is a label such as `'Account'`). A scoped
   * query never finds a row of another owner, so "does not exist" and "is not yours" give the same answer and the
   * API never reveals a foreign id.
   */
  orNotFound<T>(row: T | null, resource: string): T {
    if (row === null) {
      throw new NotFoundException(`${resource} not found`)
    }

    return row
  }
}
