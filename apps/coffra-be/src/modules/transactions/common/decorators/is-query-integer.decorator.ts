import { applyDecorators } from '@nestjs/common'
import { Transform, type TransformFnParams } from 'class-transformer'
import { buildMessage, ValidateBy } from 'class-validator'

import { QUERY_INTEGER_PATTERN } from '../constants'

/**
 * Turns the plain spelling of a whole number into a number.
 *
 * Anything else stays as it came and is refused by the validator.
 *
 * @param params - the value being transformed
 * @returns the number, or the value unchanged
 */
const toInteger = ({ value }: TransformFnParams): unknown => {
  const raw: unknown = value
  return typeof raw === 'string' && QUERY_INTEGER_PATTERN.test(raw) ? Number(raw) : raw
}

/**
 * Validates a whole number from a query string, from `min` to `max`.
 *
 * A query parameter is always a string and the global `ValidationPipe` does not convert it. Strict on purpose:
 * `Number()` would also take `1e2`, `0x10`, `" 2 "` and `""` (as 0). A repeated parameter arrives as a list and is
 * refused.
 *
 * @param min - the smallest accepted number
 * @param max - the largest accepted number
 * @returns the property decorator
 */
export const IsQueryInteger = (min: number, max: number): ReturnType<typeof applyDecorators> =>
  applyDecorators(
    Transform(toInteger),
    ValidateBy({
      name: 'isQueryInteger',
      constraints: [min, max],
      validator: {
        validate: (value: unknown) =>
          typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max,
        defaultMessage: buildMessage(
          (eachPrefix) => `${eachPrefix}$property must be a whole number from $constraint1 to $constraint2`,
        ),
      },
    }),
  )
