import { randomUUID } from 'node:crypto'

import type { AuthSource, User } from '../../../src/modules/prisma'

type Identity = { authSource: AuthSource; externalSubject: string }

type UpsertArgs = {
  where: { authSource_externalSubject: Identity }
  create: Identity & { email: string }
  update: { email: string }
}

const identityKey = ({ authSource, externalSubject }: Identity): string => `${authSource}/${externalSubject}`

/**
 * Stands in for `PrismaService` in the e2e specs, with just what the auth flow uses: the real `UsersService` runs
 * on top of it. It reads the same `where` shapes as the real client, so a changed query shows up as a failing spec
 * (an unknown `where` throws) instead of being silently accepted.
 */
export class InMemoryPrisma {
  private readonly rows = new Map<string, User>()

  readonly user = {
    upsert: ({ where, create, update }: UpsertArgs): Promise<User> => {
      const existing = [...this.rows.values()].find(
        (row) => identityKey(row) === identityKey(where.authSource_externalSubject),
      )

      if (existing) {
        const updated = { ...existing, email: update.email, updatedAt: new Date() }
        this.rows.set(updated.id, updated)
        return Promise.resolve(updated)
      }

      const now = new Date()
      const created: User = { id: randomUUID(), ...create, createdAt: now, updatedAt: now }
      this.rows.set(created.id, created)
      return Promise.resolve(created)
    },

    findUnique: ({ where }: { where: { id: string } }): Promise<User | null> =>
      Promise.resolve(this.rows.get(where.id) ?? null),
  }

  /** The health check's `SELECT 1`. */
  readonly $queryRaw = (): Promise<unknown[]> => Promise.resolve([])

  /** Every user row, for specs that assert nobody was created or changed. */
  users(): User[] {
    return [...this.rows.values()]
  }

  /** The user is deleted while its tokens are still valid. */
  deleteUsers(): void {
    this.rows.clear()
  }
}
