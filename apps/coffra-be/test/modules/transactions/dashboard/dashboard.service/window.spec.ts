import { describe, expect, it, vi } from 'vitest'

import { TIME_ZONES, useTimeZone } from '../../../../utils/use-time-zone'

import { OWNER, useDashboardService } from './setup'

// The window follows the UTC day of the clock, never the local one: the server may stand anywhere, and the API speaks
// UTC. Each case sits at the very edge of a UTC day, where the local day is a different one east or west of UTC.
describe.each(TIME_ZONES)('DashboardService.get with the server in %s', (zone, offset) => {
  useTimeZone(zone, offset)

  const { service, categoryTotals } = useDashboardService()

  /** Stops the clock at `instant` and returns the window the dashboard asked the totals service for. */
  const windowAt = async (instant: string, period: '3m' | '6m' | '1y' = '3m') => {
    vi.setSystemTime(new Date(instant))
    await service.get(OWNER, { period })

    return categoryTotals.mock.calls.at(-1)?.[1]
  }

  it('is still October in the last second of 31 October UTC', async () => {
    expect(await windowAt('2026-10-31T23:59:59.000Z')).toStrictEqual({ from: '2026-08-01', to: '2026-10-31' })
  })

  it('is already November in the first second of 1 November UTC', async () => {
    expect(await windowAt('2026-11-01T00:00:00.000Z')).toStrictEqual({ from: '2026-09-01', to: '2026-11-30' })
  })

  it('ends on the leap day in the last second of 29 February UTC', async () => {
    expect(await windowAt('2024-02-29T23:59:59.000Z')).toStrictEqual({ from: '2023-12-01', to: '2024-02-29' })
  })

  it('crosses the turn of the year at midnight UTC, not at the local midnight', async () => {
    expect(await windowAt('2025-12-31T23:59:59.000Z', '1y')).toStrictEqual({ from: '2025-01-01', to: '2025-12-31' })
    expect(await windowAt('2026-01-01T00:00:00.000Z', '1y')).toStrictEqual({ from: '2025-02-01', to: '2026-01-31' })
  })
})

describe('DashboardService.get at the stopped clock', () => {
  const { service, categoryTotals } = useDashboardService()

  it('reads the clock on every call: a later call sees a later month', async () => {
    await service.get(OWNER, {})
    vi.setSystemTime(new Date('2026-11-15T10:00:00.000Z'))
    await service.get(OWNER, {})

    expect(categoryTotals.mock.calls.map(([, window]) => window)).toStrictEqual([
      { from: '2026-08-01', to: '2026-10-31' },
      { from: '2026-09-01', to: '2026-11-30' },
    ])
  })
})
