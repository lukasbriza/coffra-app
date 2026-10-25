import { Matches } from 'class-validator'

import { POSITIVE_DECIMAL_PATTERN } from '../constants'

/**
 * Validates an amount greater than zero, sent as a decimal string (`"1250.5"`), never a JSON number.
 *
 * The sign of a transaction comes from its type, so the amount itself is never negative. Checked before the database
 * sees it, so zero or an amount that does not fit the column is a 400, not a 500 from the CHECK.
 *
 * @returns the property decorator
 */
export const IsPositiveDecimalAmount = (): PropertyDecorator =>
  Matches(POSITIVE_DECIMAL_PATTERN, {
    message: '$property must be a positive decimal string with at most 15 integer digits and 4 decimal places',
  })
