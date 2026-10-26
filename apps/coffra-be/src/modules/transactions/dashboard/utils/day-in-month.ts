import { daysInMonth } from './days-in-month'

/**
 * Gives the first or the last day of a month, counted from the year 0.
 *
 * A month is named by its index, `year × 12 + (month − 1)`, so that going back several months is a subtraction that
 * crosses the turn of the year by itself. It is plain arithmetic on numbers: no `Date`, so no time zone is involved.
 *
 * @param index - the index of the month: January of the year 2026 is `24312`
 * @param which - `first` for the first day, `last` for the last
 * @returns the day as `YYYY-MM-DD`, e.g. `2026-02-28`
 */
export const dayInMonth = (index: number, which: 'first' | 'last'): string => {
  const year = Math.floor(index / 12)
  const month = (index % 12) + 1
  const day = which === 'first' ? 1 : daysInMonth(year, month)

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
