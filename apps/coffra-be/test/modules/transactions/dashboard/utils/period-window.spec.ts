import { describe, expect, it } from 'vitest'

import { PERIOD_MONTHS, PERIODS } from '../../../../../src/modules/transactions/dashboard/constants'
import type { Period } from '../../../../../src/modules/transactions/dashboard/dashboard.types'
import { periodWindow } from '../../../../../src/modules/transactions/dashboard/utils/period-window'
import { parseIsoDate } from '../../../../../src/utils'

/** The number of the last day of a month, from a source that knows the calendar (`Date`). */
const lastDayOf = (year: number, month: number): number => new Date(Date.UTC(year, month, 0)).getUTCDate()

describe('periodWindow', () => {
  it.each<[today: string, period: Period, from: string, to: string]>([
    // An ordinary day in the middle of a month.
    ['2026-10-26', '3m', '2026-08-01', '2026-10-31'],
    ['2026-10-26', '6m', '2026-05-01', '2026-10-31'],
    ['2026-10-26', '1y', '2025-11-01', '2026-10-31'],
    // The first and the last day of a month give the same window as any day in between.
    ['2026-03-01', '3m', '2026-01-01', '2026-03-31'],
    ['2026-03-31', '3m', '2026-01-01', '2026-03-31'],
    // January: the window reaches into the year before.
    ['2026-01-15', '3m', '2025-11-01', '2026-01-31'],
    ['2026-01-15', '6m', '2025-08-01', '2026-01-31'],
    ['2026-01-15', '1y', '2025-02-01', '2026-01-31'],
    // December: a year is exactly the calendar year.
    ['2026-12-31', '3m', '2026-10-01', '2026-12-31'],
    ['2026-12-31', '6m', '2026-07-01', '2026-12-31'],
    ['2026-12-31', '1y', '2026-01-01', '2026-12-31'],
    // February: leap, not leap, and the centuries.
    ['2024-02-29', '3m', '2023-12-01', '2024-02-29'],
    ['2024-02-29', '1y', '2023-03-01', '2024-02-29'],
    ['2028-02-10', '3m', '2027-12-01', '2028-02-29'],
    ['2000-02-10', '3m', '1999-12-01', '2000-02-29'],
    ['2026-02-28', '3m', '2025-12-01', '2026-02-28'],
    ['2100-02-10', '3m', '2099-12-01', '2100-02-28'],
    // A 30-day month, and a window that begins in a leap February.
    ['2026-04-30', '3m', '2026-02-01', '2026-04-30'],
    ['2024-04-10', '3m', '2024-02-01', '2024-04-30'],
    // Six months that fit in one year.
    ['2026-06-30', '6m', '2026-01-01', '2026-06-30'],
  ])('on %s the period %s covers %s .. %s', (today, period, from, to) => {
    expect(periodWindow(period, today)).toStrictEqual({ from, to })
  })

  describe('on every day of seven years', () => {
    /** Every day from 2023-01-01 to 2029-12-31, which holds the leap years 2024 and 2028. */
    const days: string[] = []

    for (
      let time = parseIsoDate('2023-01-01').getTime();
      time <= parseIsoDate('2029-12-31').getTime();
      time += 86_400_000
    ) {
      days.push(new Date(time).toISOString().slice(0, 10))
    }

    it.each(PERIODS)('the period %s starts on a first day and ends on the last day of the month of today', (period) => {
      for (const today of days) {
        const { from, to } = periodWindow(period, today)
        const [year = 0, month = 0] = today.split('-').map(Number)

        expect(from.endsWith('-01'), `${today}: ${from}`).toBe(true)
        expect(to, today).toBe(`${today.slice(0, 8)}${String(lastDayOf(year, month)).padStart(2, '0')}`)
      }
    })

    it.each(PERIODS)('the period %s spans exactly the number of calendar months it names', (period) => {
      for (const today of days) {
        const { from, to } = periodWindow(period, today)
        const [fromYear = 0, fromMonth = 0] = from.split('-').map(Number)
        const [toYear = 0, toMonth = 0] = to.split('-').map(Number)

        expect(toYear * 12 + toMonth - (fromYear * 12 + fromMonth) + 1, today).toBe(PERIOD_MONTHS[period])
      }
    })

    it('does not change within a month', () => {
      expect(periodWindow('1y', '2026-10-01')).toStrictEqual(periodWindow('1y', '2026-10-31'))
    })
  })
})
