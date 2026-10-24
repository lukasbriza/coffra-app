import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'

import { OwnershipModule } from '../../../../../src/modules/core/ownership/ownership.module'
import { PrismaService } from '../../../../../src/modules/prisma'
import { TransactionsService } from '../../../../../src/modules/transactions/transactions/transactions.service'

const findFirst = (): Promise<null> => Promise.resolve(null)

describe('TransactionsService dependency injection', () => {
  it('resolves PrismaService and OwnershipService through @Inject', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [OwnershipModule],
      providers: [TransactionsService, { provide: PrismaService, useValue: { transaction: { findFirst } } }],
    }).compile()

    const service = moduleRef.get(TransactionsService)

    // Both dependencies are in place: the query runs and the 404 comes from the ownership layer.
    await expect(
      service.findOne({ userId: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11' }, '9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d'),
    ).rejects.toThrow('Transaction not found')
  })
})
