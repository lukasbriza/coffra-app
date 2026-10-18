import { describe, expect, it } from 'vitest'

import { Prisma } from '../../../../src/modules/prisma'
import { formatMoney } from '../../../../src/modules/transactions/common/format-money'

describe('formatMoney', () => {
  it.each([
    ['0', '0.0000'],
    ['1250.5', '1250.5000'],
    ['-1500.25', '-1500.2500'],
    ['0.0001', '0.0001'],
    ['-0.0001', '-0.0001'],
    ['999999999999999.9999', '999999999999999.9999'],
    ['-999999999999999.9999', '-999999999999999.9999'],
  ])('writes %s as %s', (stored, expected) => {
    expect(formatMoney(new Prisma.Decimal(stored))).toBe(expected)
  })

  it('never writes an exponent, where toString() would', () => {
    const tiny = new Prisma.Decimal('0.0000001')

    expect(tiny.toString()).toBe('1e-7')
    expect(formatMoney(tiny)).toBe('0.0000')
  })

  it('writes the same amount as the same string, however it was stored', () => {
    expect(formatMoney(new Prisma.Decimal('12.5'))).toBe(formatMoney(new Prisma.Decimal('12.5000')))
  })
})
