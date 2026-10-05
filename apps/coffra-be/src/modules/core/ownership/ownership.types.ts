/**
 * Whose data a request works with: today the signed-in user, with shared workspaces the active workspace.
 * Domain code treats it as opaque: it gets it from `@CurrentOwner()`, hands it to `OwnershipService` and never
 * reads its fields, so a change of what owns the data does not touch the domain services.
 */
export type Owner = {
  readonly userId: string
}

/** Prisma `where` fragment that limits a model carrying the owner columns to the owner's rows. */
export type OwnerScope = {
  userId: string
}

/** Owner columns of a new row, spread into Prisma `data`. */
export type OwnerData = {
  userId: string
}
