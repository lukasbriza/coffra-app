import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'

import { OwnershipModule } from '../../../../../src/modules/core/ownership/ownership.module'
import { PrismaService } from '../../../../../src/modules/prisma'
import { TransactionTotalsService } from '../../../../../src/modules/transactions/totals/totals.service'

const groupBy = (): Promise<[]> => Promise.resolve([])

describe('TransactionTotalsService dependency injection', () => {
  it('resolves PrismaService and OwnershipService through @Inject', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [OwnershipModule],
      providers: [TransactionTotalsService, { provide: PrismaService, useValue: { transaction: { groupBy } } }],
    }).compile()

    const service = moduleRef.get(TransactionTotalsService)

    // Both dependencies are in place: the query runs and the scope comes from the ownership layer.
    await expect(
      service.categoryTotals(
        { userId: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11' },
        { from: '2026-08-01', to: '2026-10-31' },
      ),
    ).resolves.toEqual([])
  })
})
