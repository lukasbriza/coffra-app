import { describe, expect, it } from 'vitest'

import { formatIsoDate, parseIsoDate } from '../../src/utils'

import { CALENDAR_DAYS, TIME_ZONES, useTimeZone } from './use-time-zone'

describe('formatIsoDate', () => {
  describe.each(TIME_ZONES)('with the server in %s', (zone, offset) => {
    useTimeZone(zone, offset)

    it.each(CALENDAR_DAYS)('writes the column value of %s as the same day', (day) => {
      expect(formatIsoDate(new Date(`${day}T00:00:00.000Z`))).toBe(day)
    })

    it.each(CALENDAR_DAYS)('gives %s back after parseIsoDate', (day) => {
      expect(formatIsoDate(parseIsoDate(day))).toBe(day)
    })
  })
})
