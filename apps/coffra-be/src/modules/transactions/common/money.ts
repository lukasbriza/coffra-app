import { Prisma } from '../../prisma'

import { SUM_PRECISION } from './constants'

/**
 * Decimal arithmetic with `SUM_PRECISION` significant digits, so a sum of many large amounts stays exact.
 *
 * The precision belongs to the class of the left operand: `a.plus(b)` is exact when `a` is a `Money`, while
 * `new Prisma.Decimal(0).plus(a)` rounds to the 20 digits of `Prisma.Decimal` whatever `a` is. Start a sum from a
 * `Money` value, never from a plain `Prisma.Decimal`.
 */
export const Money = Prisma.Decimal.clone({ precision: SUM_PRECISION })
