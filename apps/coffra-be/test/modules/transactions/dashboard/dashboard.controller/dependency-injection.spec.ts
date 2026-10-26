import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'

import { DashboardController } from '../../../../../src/modules/transactions/dashboard/dashboard.controller'
import { DashboardService } from '../../../../../src/modules/transactions/dashboard/dashboard.service'

const get = (): Promise<{ currencies: [] }> => Promise.resolve({ currencies: [] })

describe('DashboardController dependency injection', () => {
  it('resolves its dependencies through @Inject', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: { get } }],
    }).compile()

    await expect(moduleRef.get(DashboardController).get({ userId: 'user-1' }, {})).resolves.toEqual({ currencies: [] })
  })
})
