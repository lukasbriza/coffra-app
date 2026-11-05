import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'

import { OwnerDataEraser } from '../../../../../src/modules/core'
import { ErasureModule } from '../../../../../src/modules/transactions/erasure/erasure.module'
import { TransactionsDataEraser } from '../../../../../src/modules/transactions/erasure/transactions-data.eraser'

import { OWNER, useTransactionsDataEraser } from './setup'

describe('TransactionsDataEraser dependency injection', () => {
  const { tx, client } = useTransactionsDataEraser()

  it('resolves the ownership layer through @Inject and needs no PrismaService (it writes only through the transaction)', async () => {
    // No `PrismaService` anywhere in this module: an eraser that injected one would not compile here.
    const moduleRef = await Test.createTestingModule({ imports: [ErasureModule] }).compile()

    // The ownership layer is in place: the scope of the owner reaches the query.
    await moduleRef.get(TransactionsDataEraser).eraseOwnerData(OWNER, client)

    expect(tx.account.deleteMany).toHaveBeenCalledExactlyOnceWith({ where: { userId: OWNER.userId } })
  })

  it('carries @OwnerDataEraser(), so the deletion of core finds it', () => {
    expect(Reflect.getMetadata(OwnerDataEraser.KEY, TransactionsDataEraser)).toBeDefined()
  })
})
