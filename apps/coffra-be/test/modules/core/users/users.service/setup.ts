import 'reflect-metadata'

import { beforeEach, vi } from 'vitest'

import { UsersService } from '../../../../../src/modules/core/users/users.service'
import { AuthSource, type PrismaService, type User } from '../../../../../src/modules/prisma'

// Shared by the use case specs of `UsersService` (upsertByExternalSubject, findById).

export const SUBJECT = 'dde84b4e-03ed-4990-a23b-e1be2e5eaf1a'

export const row = (overrides: Partial<User> = {}): User => ({
  id: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11',
  email: 'dev@coffra.local',
  authSource: AuthSource.oidc,
  externalSubject: SUBJECT,
  createdAt: new Date('2026-10-03T08:00:00Z'),
  updatedAt: new Date('2026-10-03T08:00:00Z'),
  ...overrides,
})

/**
 * The service over a mocked Prisma. Call it inside a `describe`: it registers the `beforeEach` that resets the
 * mocks for that block.
 */
export const useUsersService = () => {
  const upsert = vi.fn<(args: unknown) => Promise<User>>()
  const findUnique = vi.fn<(args: unknown) => Promise<User | null>>()
  const prisma = { user: { upsert, findUnique } } as unknown as PrismaService
  const service = new UsersService(prisma)

  beforeEach(() => {
    upsert.mockReset()
    findUnique.mockReset()
  })

  return { service, prisma, upsert, findUnique }
}
