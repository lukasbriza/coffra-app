import 'reflect-metadata'

import { afterEach, beforeEach, vi } from 'vitest'

import type { Owner } from '../../../../../src/modules/core'
import { Money } from '../../../../../src/modules/transactions/common/money'
import { DashboardService } from '../../../../../src/modules/transactions/dashboard/dashboard.service'
import type { TransactionTotalsService } from '../../../../../src/modules/transactions/totals/totals.service'
import type { CategoryTotal } from '../../../../../src/modules/transactions/totals/totals.types'

// Shared by the use case specs of `DashboardService`. The totals service is a mock: what the dashboard asks of it is
// pinned here, what it answers is made up by each spec.

export const OWNER: Owner = { userId: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11' }

export const FOOD = '11111111-1111-4111-8111-111111111111'
export const RENT = '22222222-2222-4222-8222-222222222222'
export const SALARY = '33333333-3333-4333-8333-333333333333'

/** The moment the clock stands at unless a spec moves it: the 26th of October 2026, noon UTC. */
export const NOW = '2026-10-26T12:00:00.000Z'

/**
 * A row of the totals service: the amounts are `Money`, as the service returns them.
 *
 * @param currency - three capital letters
 * @param category - id and name of the category; `null` for the transactions without one
 * @param income - sum of the income
 * @param expense - sum of the expense
 * @returns the row
 */
export const row = (
  currency: string,
  category: [id: string, name: string] | null,
  income: string,
  expense: string,
): CategoryTotal => ({
  currency,
  category: category === null ? null : { id: category[0], name: category[1] },
  income: new Money(income),
  expense: new Money(expense),
})

/**
 * The service over a mocked totals service, with the clock stopped at `NOW`. Call it inside a `describe`: it registers
 * the `beforeEach` and `afterEach` for that block. The totals service answers no rows unless a spec says otherwise.
 *
 * Only `Date` is faked, so timers and promises behave as usual; a spec moves the clock with `vi.setSystemTime`.
 *
 * @returns the service and the mock behind it
 */
export const useDashboardService = () => {
  const categoryTotals = vi.fn<TransactionTotalsService['categoryTotals']>()
  const service = new DashboardService({ categoryTotals } as unknown as TransactionTotalsService)

  beforeEach(() => {
    categoryTotals.mockReset().mockResolvedValue([])
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(NOW))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  return { service, categoryTotals }
}
