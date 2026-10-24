import { buildMessage, ValidateBy, type ValidationArguments } from 'class-validator'

import { isIsoDate } from './is-iso-date.decorator'

/**
 * The check of `@IsNotBefore()`: the value is not before the day in the other property of the same object.
 *
 * A day that is missing or invalid on either side passes here, because its own `@IsIsoDate()` reports it, once.
 *
 * @param value - the day being validated
 * @param args - the validation arguments; `constraints[0]` names the other property
 * @returns `false` only when both are valid days and `value` is earlier
 */
const isNotBefore = (value: unknown, { constraints, object }: ValidationArguments): boolean => {
  const [property] = constraints as [string]
  const other = (object as Record<string, unknown>)[property]

  if (!isIsoDate(value) || !isIsoDate(other)) {
    return true
  }

  // `YYYY-MM-DD` with a four-digit year compares as a string in calendar order.
  return value >= other
}

/**
 * Validates a calendar day that is not before the day in another property of the same object: `@IsNotBefore('from')`
 * on `to`.
 *
 * A range with both ends inclusive, so the same day twice is one day, not an empty range. Goes with `@IsIsoDate()` on
 * both.
 *
 * @param property - name of the property holding the earliest allowed day
 * @returns the property decorator
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
