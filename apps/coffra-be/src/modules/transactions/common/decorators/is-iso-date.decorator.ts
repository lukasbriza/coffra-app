import { buildMessage, ValidateBy } from 'class-validator'

import { formatIsoDate, parseIsoDate } from '../../../../utils'
import { ISO_DATE_PATTERN } from '../constants'

/** Whether `value` is a calendar day `YYYY-MM-DD` that exists, years 0001–9999: the check of `@IsIsoDate()`. */
export const isIsoDate = (value: unknown): value is string => {
  // Year 0 does not exist in Postgres; JavaScript would accept it.
  if (typeof value !== 'string' || !ISO_DATE_PATTERN.test(value) || value.startsWith('0000')) {
    return false
  }

  const date = parseIsoDate(value)

  // `2026-02-30` parses as 2 March: only a day that exists comes back as the same string.
  return !Number.isNaN(date.getTime()) && formatIsoDate(date) === value
}

/**
 * A calendar day `YYYY-MM-DD` that exists, years 0001–9999. No time and no time zone: the column is a `DATE`.
 */
export const IsIsoDate = (): PropertyDecorator =>
  ValidateBy({
    name: 'isIsoDate',
    validator: {
      validate: isIsoDate,
      defaultMessage: buildMessage((eachPrefix) => `${eachPrefix}$property must be a calendar date YYYY-MM-DD`),
    },
  })
