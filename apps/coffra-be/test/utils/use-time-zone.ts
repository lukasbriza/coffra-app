import { afterEach, beforeEach, expect, vi } from 'vitest'

// Shared by the specs that prove a calendar day does not move with the time zone of the server (`parseIsoDate`,
// `formatIsoDate`, the transaction mapper).

/**
 * Zones far apart and with odd offsets, each with the `getTimezoneOffset()` it gives on 2026-01-15 (no summer time
 * anywhere in the list on that day): UTC+14 and UTC−11 are the extremes, a day apart.
 */
export const TIME_ZONES: [zone: string, offset: number][] = [
  ['UTC', 0],
  ['Pacific/Kiritimati', -840],
  ['Pacific/Pago_Pago', 660],
  ['Asia/Kathmandu', -345],
  ['America/St_Johns', 210],
  ['Europe/Prague', -60],
]

/** Ordinary days, a leap day, the summer time switches in Prague, and the ends of the accepted range. */
export const CALENDAR_DAYS = [
  '2026-10-19',
  '2024-02-29',
  '2026-03-29',
  '2026-10-25',
  '0001-01-01',
  '0050-06-15',
  '9999-12-31',
]

/**
 * Runs the tests of the block with `TZ` set to `zone`. Node applies a new `TZ` at once; every test first checks that
 * the zone took effect, so a run where it did not cannot pass for the wrong reason.
 */
export const useTimeZone = (zone: string, offset: number): void => {
  beforeEach(() => {
    vi.stubEnv('TZ', zone)
    expect(new Date('2026-01-15T12:00:00Z').getTimezoneOffset()).toBe(offset)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })
}
