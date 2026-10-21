import { applyDecorators } from '@nestjs/common'
import { Transform, type TransformFnParams } from 'class-transformer'
import { buildMessage, ValidateBy } from 'class-validator'

import { QUERY_INTEGER_PATTERN } from '../constants'

// Only the plain spelling of a whole number becomes a number; anything else stays as it came and is refused.
const toInteger = ({ value }: TransformFnParams): unknown => {
  const raw: unknown = value
  return typeof raw === 'string' && QUERY_INTEGER_PATTERN.test(raw) ? Number(raw) : raw
}

/**
 * A whole number from a query string, from `min` to `max`. A query parameter is always a string and the global
 * `ValidationPipe` does not convert it. Strict on purpose: `Number()` would also take `1e2`, `0x10`, `" 2 "` and `""`
 * (as 0). A repeated parameter arrives as a list and is refused.
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
