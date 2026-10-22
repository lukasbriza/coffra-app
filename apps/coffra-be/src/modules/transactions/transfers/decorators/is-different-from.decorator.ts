import { buildMessage, isUUID, ValidateBy, type ValidationArguments } from 'class-validator'

const isDifferentFrom = (value: unknown, { constraints, object }: ValidationArguments): boolean => {
  const [property] = constraints as [string]
  const other = (object as Record<string, unknown>)[property]

  // An id that is missing or invalid on either side is reported by its own validator, once.
  if (!isUUID(value) || !isUUID(other)) {
    return true
  }

  return value !== other
}

/**
 * A UUID that is not the one in `property` of the same object (`@IsDifferentFrom('fromAccountId')` on
 * `toAccountId`). It compares the strings as they are, so it goes with `@IsAccountId()` on both, which lower-cases
 * them.
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
