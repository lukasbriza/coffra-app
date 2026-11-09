import { describe, expect, it } from 'vitest'

import { addDays } from '../../../../scripts/seed/utils/add-days'
import { TIME_ZONES, useTimeZone } from '../../../utils/use-time-zone'

describe('addDays', () => {
  describe.each(TIME_ZONES)('with the server in %s', (zone, offset) => {
    useTimeZone(zone, offset)

    it.each([
      ['2026-10-30', 3, '2026-11-02'],
      ['2026-12-30', 3, '2027-01-02'],
      ['2024-02-27', 3, '2024-03-01'],
      ['2026-02-27', 3, '2026-03-02'],
      ['2026-03-29', 1, '2026-03-30'],
      ['2026-10-25', 1, '2026-10-26'],
      ['2026-10-30', 0, '2026-10-30'],
      ['2026-03-01', -1, '2026-02-28'],
    ])('adds %s and %i days to get %s', (day, days, expected) => {
      expect(addDays(day, days)).toBe(expected)
    })
  })
})
