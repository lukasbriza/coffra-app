import type { Account, Category, PrismaService, Transaction, User } from '../../../src/modules/prisma'

/** Every row of every table, in a fixed order. Two snapshots are equal only if nothing was written in between. */
export type Snapshot = {
  users: User[]
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
}

/**
 * Reads the whole database, `updatedAt` included, so an update that changes nothing visible still shows.
 *
 * @param prisma - the client of the app under test
 * @returns the rows of all tables, ordered by id
 */
export const takeSnapshot = async (prisma: PrismaService): Promise<Snapshot> => {
  const orderBy = { id: 'asc' } as const

  return {
    users: await prisma.user.findMany({ orderBy }),
    accounts: await prisma.account.findMany({ orderBy }),
    categories: await prisma.category.findMany({ orderBy }),
    transactions: await prisma.transaction.findMany({ orderBy }),
  }
}
