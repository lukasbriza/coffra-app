import { formatIsoDate, parseIsoDate } from '../../../src/utils'

const DAY_MS = 86_400_000

/**
 * A day some days after another. Computed on midnight UTC, which has no summer time, so the result is the same in
 * every time zone of the server.
 *
 * @param day - a day `YYYY-MM-DD`
 * @param days - days to add
 * @returns the later day, `YYYY-MM-DD`
 */
export const addDays = (day: string, days: number): string =>
  formatIsoDate(new Date(parseIsoDate(day).getTime() + days * DAY_MS))
