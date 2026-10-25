import { Prisma } from './generated/client'
import type { PrismaErrorCode } from './prisma.constants'

/**
 * Tells whether a query failed with the given known Prisma error code: `isPrismaError(error, PrismaErrorCode.X)`.
 *
 * @param error - whatever the query threw
 * @param code - the code to look for
 * @returns `true` for a known request error with that code, which narrows `error` to it
 */
export const isPrismaError = (error: unknown, code: PrismaErrorCode): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
