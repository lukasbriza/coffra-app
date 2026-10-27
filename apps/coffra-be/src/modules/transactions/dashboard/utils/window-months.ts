import type { TotalsRange } from '../../totals/totals.types'

import { dayInMonth } from './day-in-month'
import { monthIndex } from './month-index'

/**
 * Lists the calendar months a window covers, the oldest first.
 *
 * A window is made of whole months, so the list runs from the month of `from` to the month of `to`. For example, for
 * `2025-11-01 .. 2026-01-31`:
 *
 * ```
 * ['2025-11', '2025-12', '2026-01']
 * ```
 *
 * It is plain arithmetic on the months (see `monthIndex`), so the turn of the year needs no special case and no time
 * zone is involved.
 *
 * @param window - the first and the last day, both inclusive
 * @returns the months as `YYYY-MM`, one more than the number of months between the two; empty when `from` is in a
 * later month than `to`
 */
export const windowMonths = ({ from, to }: TotalsRange): string[] => {
  const months: string[] = []

  for (let index = monthIndex(from); index <= monthIndex(to); index += 1) {
    // The first day of the month, without its day: `2026-10-01` is the month `2026-10`.
    months.push(dayInMonth(index, 'first').slice(0, 7))
  }

  return months
}
