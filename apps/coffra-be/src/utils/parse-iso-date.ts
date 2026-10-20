/**
 * The `Date` for a date-only column (`@db.Date`): midnight UTC of the calendar day `YYYY-MM-DD`. The driver adapter
 * writes the UTC date part, so a date built from local time (`new Date(year, month, day)`) would move by a day in a
 * time zone east of UTC. Expects a validated day; parsing the ISO string (not `Date.UTC`) keeps the years 0–99 as they
 * are.
 */
export const parseIsoDate = (value: string): Date => new Date(`${value}T00:00:00.000Z`)
