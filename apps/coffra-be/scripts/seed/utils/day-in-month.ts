import type { YearMonth } from '../types'

/**
 * A day of a month as `YYYY-MM-DD`.
 *
 * @param month - the month
 * @param day - day of the month, which must exist in it
 * @returns e.g. `2026-03-05`
 */
export const dayInMonth = ({ year, month }: YearMonth, day: number): string =>
  `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
