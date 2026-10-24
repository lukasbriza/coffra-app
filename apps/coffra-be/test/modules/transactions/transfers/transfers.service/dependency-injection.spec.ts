import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'

import { OwnershipModule } from '../../../../../src/modules/core/ownership/ownership.module'
import { PrismaService } from '../../../../../src/modules/prisma'
import { TransfersService } from '../../../../../src/modules/transactions/transfers/transfers.service'

const deleteMany = (): Promise<{ count: number }> => Promise.resolve({ count: 0 })

describe('TransfersService dependency injection', () => {
  it('resolves PrismaService and OwnershipService through @Inject', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [OwnershipModule],
      providers: [TransfersService, { provide: PrismaService, useValue: { transaction: { deleteMany } } }],
    }).compile()

    const service = moduleRef.get(TransfersService)

    // Both dependencies are in place: the query runs and the 404 comes from the ownership layer.
    await expect(
      service.remove({ userId: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11' }, '1f2e3d4c-5b6a-4987-8a6b-5c4d3e2f1a0b'),
    ).rejects.toThrow('Transfer not found')
  })
})
