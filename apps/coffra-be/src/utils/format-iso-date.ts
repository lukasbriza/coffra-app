/**
 * Formats the calendar day of a date-only value (`@db.Date`, midnight UTC) as `YYYY-MM-DD`.
 *
 * Read in UTC: the local getters (`getDate()`, ...) would give the day before in a time zone west of UTC.
 *
 * @param value - the date
 * @returns the day, e.g. `2026-10-19`
 */
export const formatIsoDate = (value: Date): string => value.toISOString().slice(0, 10)
