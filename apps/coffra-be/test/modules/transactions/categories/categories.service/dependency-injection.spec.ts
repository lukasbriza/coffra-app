import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'

import { OwnershipModule } from '../../../../../src/modules/core/ownership/ownership.module'
import { PrismaService } from '../../../../../src/modules/prisma'
import { CategoriesService } from '../../../../../src/modules/transactions/categories/categories.service'

const findMany = (): Promise<[]> => Promise.resolve([])

describe('CategoriesService dependency injection', () => {
  it('resolves PrismaService and OwnershipService through @Inject', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [OwnershipModule],
      providers: [CategoriesService, { provide: PrismaService, useValue: { category: { findMany } } }],
    }).compile()

    const service = moduleRef.get(CategoriesService)

    // Both dependencies are in place: the query runs and the scope comes from the ownership layer.
    await expect(service.list({ userId: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11' })).resolves.toEqual([])
  })
})
