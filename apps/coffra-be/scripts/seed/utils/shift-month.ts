import type { YearMonth } from '../types'

/**
 * The calendar month a number of months away from the month of a day. Plain integer arithmetic on the text of the day:
 * no `Date`, so no time zone.
 *
 * @param day - a day `YYYY-MM-DD`
 * @param offset - months to move, negative for the past
 * @returns the month, with `month` from `1` to `12`
 */
export const shiftMonth = (day: string, offset: number): YearMonth => {
  const index = Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7)) - 1 + offset

  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}
