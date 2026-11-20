import type { Prisma } from '../../prisma'
import type { Owner } from '../ownership/ownership.types'

/**
 * What the API tells a user about themselves: no `externalSubject`, no `authSource`, no timestamps.
 *
 * @property id - id of the user (UUID)
 * @property email - email as the identity provider reported it at the last login
 */
export type UserProfile = {
  id: string
  email: string
}

/**
 * Identity as the identity provider asserts it, the input of `UsersService.upsertByExternalSubject`.
 *
 * @property subject - OIDC `sub`, maps to `User.externalSubject`
 * @property email - email address of the user at the provider
 */
export type UserIdentity = {
  subject: string
  email: string
}

/**
 * What the user sends to delete their account, the input of `UserDeletionService.delete`.
 *
 * @property confirm - the email of the user, exactly as stored: proof that the client means this account
 */
export type DeleteUserInput = {
  confirm: string
}

/**
 * Port of the deletion of a user: erases what one domain keeps of an owner.
 *
 * A domain that stores data of an owner provides one class that implements it and carries `@OwnerDataEraser()`;
 * `UserDeletionService` finds every such provider and calls it inside the database transaction that deletes the user,
 * so `core` never imports a domain and never touches its models.
 */
export type OwnerDataEraserInterface = {
  /**
   * Deletes every row of the owner in the models of the domain, in an order its foreign keys allow.
   *
   * Every query goes through `tx` and carries the owner scope; a row of another owner is never touched. Anything thrown
   * rolls the whole deletion back.
   *
   * @param owner - whose data to erase
   * @param tx - the client of the database transaction that deletes the user
   * @returns when the rows are gone
   */
  eraseOwnerData(owner: Owner, tx: Prisma.TransactionClient): Promise<void>
}
