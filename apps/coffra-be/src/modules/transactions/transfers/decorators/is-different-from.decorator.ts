import { buildMessage, isUUID, ValidateBy, type ValidationArguments } from 'class-validator'

/**
 * The check of `@IsDifferentFrom()`: the value is not the UUID in the other property of the same object.
 *
 * An id that is missing or invalid on either side passes here, because its own validator reports it, once.
 *
 * @param value - the id being validated
 * @param args - the validation arguments; `constraints[0]` names the other property
 * @returns `false` only when both are UUIDs and they are the same string
 */
const isDifferentFrom = (value: unknown, { constraints, object }: ValidationArguments): boolean => {
  const [property] = constraints as [string]
  const other = (object as Record<string, unknown>)[property]

  if (!isUUID(value) || !isUUID(other)) {
    return true
  }

  return value !== other
}

/**
 * Validates a UUID that is not the one in another property of the same object: `@IsDifferentFrom('fromAccountId')` on
 * `toAccountId`.
 *
 * It compares the strings as they are, so it goes with `@IsAccountId()` on both, which lower-cases them.
 *
 * @param property - name of the property holding the id it must differ from
 * @returns the property decorator
 */
export const IsDifferentFrom = (property: string): PropertyDecorator =>
  ValidateBy({
    name: 'isDifferentFrom',
    constraints: [property],
    validator: {
      validate: isDifferentFrom,
      defaultMessage: buildMessage((eachPrefix) => `${eachPrefix}$property must differ from $constraint1`),
    },
  })
