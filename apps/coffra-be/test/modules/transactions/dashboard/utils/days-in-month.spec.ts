import { describe, expect, it } from 'vitest'

import { daysInMonth } from '../../../../../src/modules/transactions/dashboard/utils/days-in-month'

describe('daysInMonth', () => {
  it.each([
    [1, 31],
    [2, 28],
    [3, 31],
    [4, 30],
    [5, 31],
    [6, 30],
    [7, 31],
    [8, 31],
    [9, 30],
    [10, 31],
    [11, 30],
    [12, 31],
  ])('gives month %i of an ordinary year %i days', (month, days) => {
    expect(daysInMonth(2026, month)).toBe(days)
  })

  it.each([2024, 2028, 2000, 1600, 4])('gives February of the leap year %i 29 days', (year) => {
    expect(daysInMonth(year, 2)).toBe(29)
  })

  it.each([2026, 2025, 2100, 1900, 1700, 1])('gives February of the year %i 28 days', (year) => {
    expect(daysInMonth(year, 2)).toBe(28)
  })

  it('leaves the other months of a leap year as they are', () => {
    expect(daysInMonth(2024, 1)).toBe(31)
    expect(daysInMonth(2024, 3)).toBe(31)
  })
})
