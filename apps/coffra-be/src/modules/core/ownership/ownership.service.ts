import { Injectable, NotFoundException } from '@nestjs/common'

import type { Owner, OwnerData, OwnerScope } from './ownership.types'

/**
 * The one place that decides whose rows a query sees and who owns a new row.
 *
 * It runs no query itself: the caller spreads the scope into its own query, so a row of another owner is never found
 * and ends the same way as a row that does not exist.
 */
@Injectable()
export class OwnershipService {
  /**
   * Builds the filter that limits a query to the rows of the owner.
   *
   * Spread into the `where` of every query on a model that carries the owner columns. A model without them is scoped
   * through the relation to its parent, e.g. `{ account: ownership.scope(owner) }`.
   *
   * @param owner - whose rows the query may see
   * @returns the `where` fragment
   */
  scope(owner: Owner): OwnerScope {
    return { userId: owner.userId }
  }

  /**
   * Builds the owner columns of a new row.
   *
   * Spread into the `data` of a create on a model that carries the owner columns.
   *
   * @param owner - who the new row will belong to
   * @returns the `data` fragment
   */
  ownerData(owner: Owner): OwnerData {
    return { userId: owner.userId }
  }

  /**
   * Returns the row a scoped query found, or throws the 404 of the resource.
   *
   * A scoped query never finds a row of another owner, so "does not exist" and "is not yours" give the same answer and
   * the API never reveals a foreign id.
   *
   * @param row - what the scoped query returned
   * @param resource - label of the resource in the message, such as `'Account'`
   * @returns the row, when there is one
   * @throws NotFoundException with `<resource> not found` when `row` is `null`
   */
  orNotFound<T>(row: T | null, resource: string): T {
    if (row === null) {
      throw new NotFoundException(`${resource} not found`)
    }

    return row
  }
}
