import { describe, expect, it } from 'vitest'

import { Prisma } from '../../../../src/modules/prisma'
import { SUM_PRECISION } from '../../../../src/modules/transactions/common/constants'
import { Money } from '../../../../src/modules/transactions/common/money'

const FULL = '999999999999999.9999'

/** Adds `FULL` `times` times, one value at a time, starting from the given zero. */
const addFull = (zero: Prisma.Decimal, times: number): Prisma.Decimal => {
  let sum = zero

  for (let i = 0; i < times; i++) {
    sum = sum.plus(FULL)
  }

  return sum
}

describe('Money', () => {
  it('has the precision of a sum', () => {
    expect(SUM_PRECISION).toBe(40)
    expect(Money.precision).toBe(SUM_PRECISION)
  })

  it('is a Prisma.Decimal, so it fits everything that takes one', () => {
    expect(new Money('1.5')).toBeInstanceOf(Prisma.Decimal)
  })

  it('adds many full amounts without rounding, one after another', () => {
    // The partial sums need 21 digits from the eleventh amount on.
    expect(addFull(new Money(0), 20).toFixed(4)).toBe('19999999999999999.9980')
    expect(addFull(new Money(0), 20).plus('0.0001').toFixed(4)).toBe('19999999999999999.9981')
  })

  it('rounds where the default Prisma.Decimal does, which is why it exists', () => {
    expect(addFull(new Prisma.Decimal(0), 20).toFixed(4)).not.toBe('19999999999999999.9980')
  })

  it('keeps the precision through plus and minus when it is the left operand', () => {
    const big = new Money('19999999999999999.9981')

    expect(big.plus(new Prisma.Decimal('0.0001')).toFixed(4)).toBe('19999999999999999.9982')
    expect(big.minus(new Prisma.Decimal('0.0001')).toFixed(4)).toBe('19999999999999999.9980')
  })

  it('loses it when a plain Prisma.Decimal is the left operand: a sum starts from a Money value', () => {
    const big = new Money('19999999999999999.9981')

    expect(new Prisma.Decimal(0).plus(big).toFixed(4)).not.toBe('19999999999999999.9981')
    expect(new Money(0).plus(big).toFixed(4)).toBe('19999999999999999.9981')
  })
})
