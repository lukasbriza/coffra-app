import 'reflect-metadata'

import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'

import { DashboardService } from '../../../../../src/modules/transactions/dashboard/dashboard.service'
import { TransactionTotalsService } from '../../../../../src/modules/transactions/totals/totals.service'

const categoryTotals = (): Promise<[]> => Promise.resolve([])
const dailyTotals = (): Promise<[]> => Promise.resolve([])

describe('DashboardService dependency injection', () => {
  it('resolves TransactionTotalsService through @Inject', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [DashboardService, { provide: TransactionTotalsService, useValue: { categoryTotals, dailyTotals } }],
    }).compile()

    await expect(moduleRef.get(DashboardService).get({ userId: 'user-1' }, {})).resolves.toMatchObject({
      currencies: [],
    })
  })
})
