import { describe, expect, it } from 'vitest'

import type { Category } from '../../../../src/modules/prisma'
import { toCategoryView } from '../../../../src/modules/transactions/categories/categories.mapper'

const row = (overrides: Partial<Category> = {}): Category => ({
  id: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f',
  userId: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11',
  tenantId: null,
  name: 'Food',
  createdAt: new Date('2026-10-18T08:00:00Z'),
  updatedAt: new Date('2026-10-18T08:00:00Z'),
  ...overrides,
})

describe('toCategoryView', () => {
  it('keeps the fields the API shows', () => {
    expect(toCategoryView(row())).toStrictEqual({ id: '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f', name: 'Food' })
  })

  it('leaves out the owner columns and the timestamps, even when tenantId is set', () => {
    const view = toCategoryView(row({ tenantId: '7d1c2b9a-5e4f-4a3b-8c2d-1e0f9a8b7c62' }))

    expect(Object.keys(view).toSorted()).toEqual(['id', 'name'])
  })
})
