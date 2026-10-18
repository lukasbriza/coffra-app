import { Matches } from 'class-validator'

import { SIGNED_DECIMAL_PATTERN } from '../constants'

/**
 * An amount sent as a decimal string (`"-1500.25"`), never a JSON number: a number loses precision before it reaches
 * the server. May be negative. Validated before the database sees it, so an amount that does not fit the column is a
 * 400, not a 500.
 */
export const IsDecimalAmount = (): PropertyDecorator =>
  Matches(SIGNED_DECIMAL_PATTERN, {
    message: '$property must be a decimal string with at most 15 integer digits and 4 decimal places',
  })
