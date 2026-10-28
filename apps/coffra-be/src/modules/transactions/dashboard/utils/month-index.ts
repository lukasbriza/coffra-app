/**
 * Gives the index of the calendar month a day is in, counted from the year 0.
 *
 * A month is named by its index, `year × 12 + (month − 1)` (see `dayInMonth`), so that going back several months is a
 * subtraction that crosses the turn of the year by itself. It is plain arithmetic on the text: no `Date`, so no time
 * zone is involved.
 *
 * @param day - a day as `YYYY-MM-DD`, e.g. `2026-10-26`
 * @returns the index of its month: January of the year 2026 is `24312`, so the example is `24321`
 */
export const monthIndex = (day: string): number => Number(day.slice(0, 4)) * 12 + (Number(day.slice(5, 7)) - 1)
