import type { Prisma } from '../../prisma'

import { MONEY_SCALE } from './constants'

/**
 * The API form of a stored amount: plain notation (never an exponent, unlike `toString()`) with exactly four decimal
 * places, so the same amount is always the same string.
 */
export const formatMoney = (value: Prisma.Decimal): string => value.toFixed(MONEY_SCALE)
