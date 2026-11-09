import { describe, expect, it } from 'vitest'

import { dayInMonth } from '../../../../scripts/seed/utils/day-in-month'

describe('dayInMonth', () => {
  it.each([
    [{ year: 2026, month: 3 }, 5, '2026-03-05'],
    [{ year: 2026, month: 12 }, 28, '2026-12-28'],
    [{ year: 2024, month: 2 }, 29, '2024-02-29'],
    [{ year: 50, month: 6 }, 15, '0050-06-15'],
  ])('writes %j and day %i as %s', (month, day, expected) => {
    expect(dayInMonth(month, day)).toBe(expected)
  })
})
