import { beforeEach, vi } from 'vitest'

import { DashboardController } from '../../../../../src/modules/transactions/dashboard/dashboard.controller'
import { DashboardService } from '../../../../../src/modules/transactions/dashboard/dashboard.service'
import type { DashboardView } from '../../../../../src/modules/transactions/dashboard/dashboard.types'
import { useControllerApp } from '../../use-controller-app'

// Shared by the use case specs of `DashboardController`: the controller behind the real guard and `configureApp`
// (`useControllerApp`), with a mocked `DashboardService`.

export { OWNER } from '../../use-controller-app'

export const CATEGORY_ID = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e6f'

export const VIEW: DashboardView = {
  period: '3m',
  from: '2026-08-01',
  to: '2026-10-31',
  currencies: [
    {
      currency: 'CZK',
      income: '5000.0000',
      expense: '150.2500',
      net: '4849.7500',
      categories: [
        { categoryId: CATEGORY_ID, name: 'Food', income: '0.0000', expense: '150.2500', net: '-150.2500' },
        { categoryId: null, name: null, income: '5000.0000', expense: '0.0000', net: '5000.0000' },
      ],
      trend: [
        { month: '2026-08', income: '5000.0000', expense: '0.0000', net: '5000.0000' },
        { month: '2026-09', income: '0.0000', expense: '0.0000', net: '0.0000' },
        { month: '2026-10', income: '0.0000', expense: '150.2500', net: '-150.2500' },
      ],
    },
  ],
}

/**
 * Boots the controller behind the real guard, with a mocked `DashboardService`. Call it inside a `describe`: it
 * registers the `beforeEach` and `afterEach` for that block.
 */
export const useDashboardController = () => {
  const dashboard = { get: vi.fn<DashboardService['get']>() }

  beforeEach(() => {
    dashboard.get.mockReset().mockResolvedValue(VIEW)
  })

  return { dashboard, ...useControllerApp(DashboardController, DashboardService, dashboard) }
}
