/**
 * The calendar day of a date-only value (`@db.Date`, midnight UTC) as `YYYY-MM-DD`. Read in UTC: the local getters
 * (`getDate()`, ...) would give the day before in a time zone west of UTC.
 */
export const formatIsoDate = (value: Date): string => value.toISOString().slice(0, 10)
