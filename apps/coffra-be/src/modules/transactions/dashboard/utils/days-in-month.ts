/**
 * Tells how many days a month of the Gregorian calendar has.
 *
 * February has 29 days in a leap year: a year divisible by 4, except the years divisible by 100 that are not divisible
 * by 400 (2000 and 2024 are leap years, 2026 and 2100 are not).
 *
 * @param year - the year, e.g. `2026`
 * @param month - the month, from `1` (January) to `12`
 * @returns 28, 29, 30 or 31
 */
export const daysInMonth = (year: number, month: number): number => {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

    return leap ? 29 : 28
  }

  // April, June, September and November.
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}
