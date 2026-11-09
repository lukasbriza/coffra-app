import { DiscoveryModule } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { describe, expect, it, vi } from 'vitest'

import { OwnershipService } from '../../../../../src/modules/core/ownership/ownership.service'
import { UserDeletionService } from '../../../../../src/modules/core/users/user-deletion.service'
import type { Prisma } from '../../../../../src/modules/prisma'
import { PrismaService } from '../../../../../src/modules/prisma'

import { USER } from './setup'

describe('UserDeletionService dependency injection', () => {
  it('resolves Prisma, the ownership layer and the discovery through @Inject', async () => {
    const tx = { user: { findUnique: vi.fn(() => Promise.resolve(USER)), delete: vi.fn(() => Promise.resolve(USER)) } }
    const $transaction = vi.fn((callback: (client: Prisma.TransactionClient) => Promise<unknown>) =>
      callback(tx as unknown as Prisma.TransactionClient),
    )
    const moduleRef = await Test.createTestingModule({
      imports: [DiscoveryModule],
      providers: [UserDeletionService, OwnershipService, { provide: PrismaService, useValue: { $transaction } }],
    }).compile()
    // Runs `onModuleInit`: the discovery is in place.
    await moduleRef.init()

    // Prisma and the ownership layer are in place: the transaction runs and the owner is built.
    await moduleRef.get(UserDeletionService).delete(USER.id, { confirm: USER.email })

    expect($transaction).toHaveBeenCalledOnce()
    expect(tx.user.delete).toHaveBeenCalledExactlyOnceWith({ where: { id: USER.id } })
    await moduleRef.close()
  })
})
