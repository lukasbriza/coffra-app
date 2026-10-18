/** Decimal places of every amount column (`Decimal(19,4)`), and of every amount the API returns. */
export const MONEY_SCALE = 4

/**
 * A signed decimal string that fits `Decimal(19,4)`: at most 15 integer digits and 4 decimal places, a plain `.` as
 * the separator, no exponent, no `+`. Anything bigger would overflow the column (a 500), anything finer be rounded.
 */
export const SIGNED_DECIMAL_PATTERN = /^-?\d{1,15}(\.\d{1,4})?$/

/** Longest name of an account or a category, after trimming. */
export const RESOURCE_NAME_MAX_LENGTH = 100
