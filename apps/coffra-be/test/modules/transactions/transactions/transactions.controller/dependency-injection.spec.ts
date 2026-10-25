import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'

import { TransactionsController } from '../../../../../src/modules/transactions/transactions/transactions.controller'
import { TransactionsService } from '../../../../../src/modules/transactions/transactions/transactions.service'

const remove = (): Promise<void> => Promise.resolve()

describe('TransactionsController dependency injection', () => {
  it('resolves its dependencies through @Inject', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [{ provide: TransactionsService, useValue: { remove } }],
    }).compile()

    await expect(moduleRef.get(TransactionsController).remove({ userId: 'user-1' }, 'id-1')).resolves.toBeUndefined()
  })
})
