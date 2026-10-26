import type { TotalsRange } from '../../totals/totals.types'
import { PERIOD_MONTHS } from '../constants'
import type { Period } from '../dashboard.types'

import { dayInMonth } from './day-in-month'

/**
 * Works out which days a period of the dashboard covers.
 *
 * The window is made of whole calendar months: the current month and the months before it, as many as the period
 * says. It starts on the first day of the oldest month and ends on the last day of the current month, so a transaction
 * planned for later this month is inside. For example, on `2026-10-26`:
 *
 * ```
 * 3m  2026-08-01 .. 2026-10-31
 * 6m  2026-05-01 .. 2026-10-31
 * 1y  2025-11-01 .. 2026-10-31
 * ```
 *
 * The function reads no clock and builds no `Date`: the caller says what today is, so the window cannot depend on the
 * time zone of the server.
 *
 * @param period - how many months back to go
 * @param today - today as `YYYY-MM-DD`, in UTC
 * @returns the first and the last day of the window, both inclusive
 */
export const periodWindow = (period: Period, today: string): TotalsRange => {
  // The index of the current month, counted from the year 0 (see `dayInMonth`).
  const current = Number(today.slice(0, 4)) * 12 + (Number(today.slice(5, 7)) - 1)

  return {
    from: dayInMonth(current - (PERIOD_MONTHS[period] - 1), 'first'),
    to: dayInMonth(current, 'last'),
  }
}
