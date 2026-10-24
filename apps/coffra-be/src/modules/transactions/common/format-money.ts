import type { Prisma } from '../../prisma'

import { MONEY_SCALE } from './constants'

/**
 * Formats a stored amount for the API.
 *
 * Plain notation (never an exponent, unlike `toString()`) with exactly four decimal places, so the same amount is
 * always the same string.
 *
 * @param value - the amount as stored
 * @returns the decimal string, e.g. `"1250.5000"`
 */
export const formatMoney = (value: Prisma.Decimal): string => value.toFixed(MONEY_SCALE)
