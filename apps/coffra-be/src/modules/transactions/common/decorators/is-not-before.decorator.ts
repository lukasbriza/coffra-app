import { buildMessage, ValidateBy, type ValidationArguments } from 'class-validator'

import { isIsoDate } from './is-iso-date.decorator'

const isNotBefore = (value: unknown, { constraints, object }: ValidationArguments): boolean => {
  const [property] = constraints as [string]
  const other = (object as Record<string, unknown>)[property]

  // A day that is missing or invalid on either side is reported by its own `@IsIsoDate()`, once.
  if (!isIsoDate(value) || !isIsoDate(other)) {
    return true
  }

  // `YYYY-MM-DD` with a four-digit year compares as a string in calendar order.
  return value >= other
}

/**
 * A calendar day not before the day in `property` of the same object (`@IsNotBefore('from')` on `to`): a range with
 * both ends inclusive, so the same day twice is one day, not an empty range. Goes with `@IsIsoDate()` on both.
 */
export const IsNotBefore = (property: string): PropertyDecorator =>
  ValidateBy({
    name: 'isNotBefore',
    constraints: [property],
    validator: {
      validate: isNotBefore,
      defaultMessage: buildMessage((eachPrefix) => `${eachPrefix}$property must not be before $constraint1`),
    },
  })
