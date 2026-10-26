import { describe, expect, it } from 'vitest'

import { dayInMonth } from '../../../../../src/modules/transactions/dashboard/utils/day-in-month'

/** The index of a month: `year × 12 + (month − 1)`. */
const indexOf = (year: number, month: number): number => year * 12 + (month - 1)

describe('dayInMonth', () => {
  it('names January of the year 2026 by the index 24312', () => {
    expect(indexOf(2026, 1)).toBe(24_312)
  })

  it.each([
    [2026, 1, '2026-01-01', '2026-01-31'],
    [2026, 2, '2026-02-01', '2026-02-28'],
    [2024, 2, '2024-02-01', '2024-02-29'],
    [2100, 2, '2100-02-01', '2100-02-28'],
    [2000, 2, '2000-02-01', '2000-02-29'],
    [2026, 4, '2026-04-01', '2026-04-30'],
    [2026, 10, '2026-10-01', '2026-10-31'],
    [2026, 12, '2026-12-01', '2026-12-31'],
  ])('gives the first and the last day of month %i-%i', (year, month, first, last) => {
    expect(dayInMonth(indexOf(year, month), 'first')).toBe(first)
    expect(dayInMonth(indexOf(year, month), 'last')).toBe(last)
  })

  it('crosses the turn of the year when the index goes below January', () => {
    expect(dayInMonth(indexOf(2026, 1) - 1, 'first')).toBe('2025-12-01')
    expect(dayInMonth(indexOf(2026, 1) - 1, 'last')).toBe('2025-12-31')
    expect(dayInMonth(indexOf(2026, 1) - 12, 'first')).toBe('2025-01-01')
  })

  it('writes the year with four digits, the month and the day with two', () => {
    expect(dayInMonth(indexOf(50, 6), 'first')).toBe('0050-06-01')
    expect(dayInMonth(indexOf(50, 6), 'last')).toBe('0050-06-30')
  })
})
