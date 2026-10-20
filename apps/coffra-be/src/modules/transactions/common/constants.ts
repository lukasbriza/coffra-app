/** Decimal places of every amount column (`Decimal(19,4)`), and of every amount the API returns. */
export const MONEY_SCALE = 4

/**
 * A signed decimal string that fits `Decimal(19,4)`: at most 15 integer digits and 4 decimal places, a plain `.` as
 * the separator, no exponent, no `+`. Anything bigger would overflow the column (a 500), anything finer be rounded.
 */
export const SIGNED_DECIMAL_PATTERN = /^-?\d{1,15}(\.\d{1,4})?$/

/**
 * `SIGNED_DECIMAL_PATTERN` without the sign and without any spelling of zero (`0`, `0.0000`, `000`): an amount the
 * CHECK `amount > 0` accepts.
 */
export const POSITIVE_DECIMAL_PATTERN = /^(?!0+(\.0+)?$)\d{1,15}(\.\d{1,4})?$/

/** The shape of a calendar day; whether the day exists is checked by `@IsIsoDate()`. */
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** Longest name of an account or a category, after trimming. */
export const RESOURCE_NAME_MAX_LENGTH = 100

/** Longest note of a transaction, after trimming. */
export const NOTE_MAX_LENGTH = 500
