/**
 * Prisma error codes a service maps to an HTTP answer. Only the ones in use: a service maps a code where it knows what
 * the code means for that operation, any other error goes on as a 500.
 */
export const PrismaErrorCode = {
  /** A unique constraint failed, e.g. a duplicate category name. */
  UniqueViolation: 'P2002',
  /** A foreign key failed: a `Restrict` on delete, or a create that points to a row that is gone. */
  ForeignKeyViolation: 'P2003',
  /** The row an update or a delete needs does not exist (any more). */
  RecordNotFound: 'P2025',
} as const

export type PrismaErrorCode = (typeof PrismaErrorCode)[keyof typeof PrismaErrorCode]
