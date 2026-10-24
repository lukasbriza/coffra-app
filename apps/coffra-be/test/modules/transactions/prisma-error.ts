import { Prisma } from '../../../src/modules/prisma'

/** The error Prisma throws for a failed query with `code` (`P2002`, `P2003`, `P2025`), for the service specs. */
export const prismaError = (code: string): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError(`query failed with ${code}`, { code, clientVersion: '7.8.0' })
