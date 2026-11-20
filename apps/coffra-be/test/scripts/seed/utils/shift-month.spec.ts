import { describe, expect, it } from 'vitest'

import { shiftMonth } from '../../../../scripts/seed/utils/shift-month'

describe('shiftMonth', () => {
  it.each([
    ['2026-10-30', 0, { year: 2026, month: 10 }],
    ['2026-10-30', -11, { year: 2025, month: 11 }],
    ['2026-01-15', -1, { year: 2025, month: 12 }],
    ['2026-12-31', 1, { year: 2027, month: 1 }],
    ['2026-03-31', -12, { year: 2025, month: 3 }],
    ['2026-01-01', -11, { year: 2025, month: 2 }],
    ['2026-12-01', 14, { year: 2028, month: 2 }],
    ['2024-02-29', -11, { year: 2023, month: 3 }],
  ])('moves %s by %i months to %j', (day, offset, expected) => {
    expect(shiftMonth(day, offset)).toStrictEqual(expected)
  })
})
