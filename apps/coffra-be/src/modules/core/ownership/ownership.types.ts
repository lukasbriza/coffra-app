/**
 * Whose data a request works with: today the signed-in user, with shared workspaces the active workspace.
 *
 * Domain code treats it as opaque: it gets it from `@CurrentOwner()`, hands it to `OwnershipService` and never reads
 * its fields, so a change of what owns the data does not touch the domain services.
 *
 * @property userId - id of the signed-in user
 */
export type Owner = {
  readonly userId: string
}

/**
 * Prisma `where` fragment that limits a model carrying the owner columns to the rows of the owner.
 *
 * @property userId - id of the owner
 */
export type OwnerScope = {
  userId: string
}

/**
 * Owner columns of a new row, spread into Prisma `data`.
 *
 * @property userId - id of the owner
 */
export type OwnerData = {
  userId: string
}
