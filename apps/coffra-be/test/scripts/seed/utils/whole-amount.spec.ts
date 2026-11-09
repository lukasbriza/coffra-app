import { describe, expect, it } from 'vitest'

import { wholeAmount } from '../../../../scripts/seed/utils/whole-amount'

describe('wholeAmount', () => {
  it.each([
    [12_500, '12500.0000'],
    [1, '1.0000'],
    [0, '0.0000'],
  ])('writes %i as %s', (value, expected) => {
    expect(wholeAmount(value)).toBe(expected)
  })

  it.each([1.5, Number.NaN, -1, Number.POSITIVE_INFINITY, 2 ** 53])('refuses %s', (value) => {
    expect(() => wholeAmount(value)).toThrow('non-negative whole number')
  })
})
