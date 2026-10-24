import { describe, expect, it } from 'vitest'

import { parseIsoDate } from '../../src/utils'

import { CALENDAR_DAYS, TIME_ZONES, useTimeZone } from './use-time-zone'

describe('parseIsoDate', () => {
  describe.each(TIME_ZONES)('with the server in %s', (zone, offset) => {
    useTimeZone(zone, offset)

    it.each(CALENDAR_DAYS)('gives midnight UTC of %s', (day) => {
      expect(parseIsoDate(day).toISOString()).toBe(`${day}T00:00:00.000Z`)
    })

    it('gives the UTC date parts the driver adapter writes to the column', () => {
      const date = parseIsoDate('2026-10-19')

      expect([date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]).toEqual([2026, 10, 19])
    })
  })

  it('keeps the years 0–99 as they are (Date.UTC would move them to 1900–1999)', () => {
    expect(parseIsoDate('0050-06-15').getUTCFullYear()).toBe(50)
  })
})
