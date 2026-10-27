import { describe, expect, it } from 'vitest'

import { dayInMonth } from '../../../../../src/modules/transactions/dashboard/utils/day-in-month'
import { monthIndex } from '../../../../../src/modules/transactions/dashboard/utils/month-index'

describe('monthIndex', () => {
  it.each<[day: string, index: number]>([
    ['2026-01-01', 24_312],
    ['2026-10-26', 24_321],
    ['2026-12-31', 24_323],
    ['2027-01-01', 24_324],
    ['0001-01-01', 12],
    ['9999-12-31', 119_999],
  ])('gives the day %s the month %d', (day, index) => {
    expect(monthIndex(day)).toBe(index)
  })

  it('is the same for every day of a month', () => {
    expect(monthIndex('2026-02-01')).toBe(monthIndex('2026-02-28'))
    expect(monthIndex('2024-02-01')).toBe(monthIndex('2024-02-29'))
  })

  it('is one more for the first day of the next month, across the turn of the year', () => {
    expect(monthIndex('2026-03-01')).toBe(monthIndex('2026-02-28') + 1)
    expect(monthIndex('2027-01-01')).toBe(monthIndex('2026-12-31') + 1)
  })

  it('is the inverse of `dayInMonth`, for the first and the last day of every month of ten years', () => {
    for (let index = 2020 * 12; index < 2030 * 12; index += 1) {
      expect(monthIndex(dayInMonth(index, 'first'))).toBe(index)
      expect(monthIndex(dayInMonth(index, 'last'))).toBe(index)
    }
  })
})
