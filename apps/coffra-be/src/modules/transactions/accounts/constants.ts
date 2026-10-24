/**
 * Significant digits of the arithmetic of a balance. The default of `Prisma.Decimal` (20) rounds a sum above about
 * 10^16 silently; a column holds 15 integer digits and four decimal places, so a few full amounts already exceed it.
 */
export const BALANCE_PRECISION = 40
