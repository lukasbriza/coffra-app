import 'reflect-metadata'

import { beforeEach, vi } from 'vitest'

import { OwnershipService } from '../../../../../src/modules/core/ownership/ownership.service'
import type { Owner } from '../../../../../src/modules/core/ownership/ownership.types'
import type { Category, PrismaService } from '../../../../../src/modules/prisma'
import { CategoriesService } from '../../../../../src/modules/transactions/categories/categories.service'

// Shared by the use case specs of `CategoriesService` (list, findOne, create, update, remove). The ownership layer is
// the real one: the specs pin the `where` it produces, not a mock of it.

export { prismaError } from '../../prisma-error'

export const OWNER: Owner = { userId: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11' }
export const CATEGORY_ID = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f'

/** The `where` of every query for `CATEGORY_ID` of `OWNER`: the id and the owner scope, nothing else. */
export const OWNED = { id: CATEGORY_ID, userId: OWNER.userId }

export const row = (overrides: Partial<Category> = {}): Category => ({
  id: CATEGORY_ID,
  userId: OWNER.userId,
  tenantId: null,
  name: 'Food',
  createdAt: new Date('2026-10-18T08:00:00Z'),
  updatedAt: new Date('2026-10-18T08:00:00Z'),
  ...overrides,
})

/** What the API shows of `row()`. */
export const VIEW = { id: CATEGORY_ID, name: 'Food' }

/**
 * The service over a mocked Prisma and the real ownership layer. Call it inside a `describe`: it registers the
 * `beforeEach` that resets the mocks for that block. `findFirst` finds `row()` unless a spec says otherwise.
 */
export const useCategoriesService = () => {
  const findMany = vi.fn<(args: unknown) => Promise<Category[]>>()
  const findFirst = vi.fn<(args: unknown) => Promise<Category | null>>()
  const create = vi.fn<(args: unknown) => Promise<Category>>()
  const update = vi.fn<(args: unknown) => Promise<Category>>()
  const remove = vi.fn<(args: unknown) => Promise<Category>>()
  const prisma = { category: { findMany, findFirst, create, update, delete: remove } } as unknown as PrismaService
  const service = new CategoriesService(prisma, new OwnershipService())

  beforeEach(() => {
    findMany.mockReset()
    findFirst.mockReset().mockResolvedValue(row())
    create.mockReset()
    update.mockReset()
    remove.mockReset()
  })

  return { service, findMany, findFirst, create, update, remove }
}
