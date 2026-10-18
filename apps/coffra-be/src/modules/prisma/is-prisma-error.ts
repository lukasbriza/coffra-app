import { Prisma } from './generated/client'
import type { PrismaErrorCode } from './prisma.constants'

/** Whether a query failed with the given known Prisma error code (`isPrismaError(error, PrismaErrorCode.X)`). */
export const isPrismaError = (error: unknown, code: PrismaErrorCode): error is Prisma.PrismaClientKnownRequestError =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
