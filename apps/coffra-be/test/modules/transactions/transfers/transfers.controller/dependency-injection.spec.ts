import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'

import { TransfersController } from '../../../../../src/modules/transactions/transfers/transfers.controller'
import { TransfersService } from '../../../../../src/modules/transactions/transfers/transfers.service'

const remove = (): Promise<void> => Promise.resolve()

describe('TransfersController dependency injection', () => {
  it('resolves its dependencies through @Inject', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TransfersController],
      providers: [{ provide: TransfersService, useValue: { remove } }],
    }).compile()

    await expect(moduleRef.get(TransfersController).remove({ userId: 'user-1' }, 'id-1')).resolves.toBeUndefined()
  })
})
