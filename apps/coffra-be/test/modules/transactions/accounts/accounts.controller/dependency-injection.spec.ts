import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'

import { AccountsController } from '../../../../../src/modules/transactions/accounts/accounts.controller'
import { AccountsService } from '../../../../../src/modules/transactions/accounts/accounts.service'

const list = (): Promise<[]> => Promise.resolve([])

describe('AccountsController dependency injection', () => {
  it('resolves its dependencies through @Inject', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [{ provide: AccountsService, useValue: { list } }],
    }).compile()

    await expect(moduleRef.get(AccountsController).list({ userId: 'user-1' }, {})).resolves.toEqual([])
  })
})
