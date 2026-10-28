import type { DayTotal } from '../totals.types'

import { compareText } from './compare-text'

/**
 * Tells which of two rows comes first in the result: the currency decides, then the day.
 *
 * Days are `YYYY-MM-DD`, so comparing them as text is comparing them as dates.
 *
 * Example of the final order: `CZK 2026-09-30`, `CZK 2026-10-01`, `EUR 2026-09-15`.
 *
 * @param a - the first row
 * @param b - the second row
 * @returns the sign of the comparison, as `Array.prototype.toSorted` wants it
 */
export const compareDays = (a: DayTotal, b: DayTotal): number =>
  compareText(a.currency, b.currency) || compareText(a.date, b.date)
