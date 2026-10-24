import { applyDecorators } from '@nestjs/common'
import { Transform, type TransformFnParams } from 'class-transformer'
import { IsUUID } from 'class-validator'

/**
 * Lower-cases a string.
 *
 * Postgres compares a `uuid` regardless of letter case, a string comparison does not. Lower-cased, an id compares
 * equal to itself however it was spelled, and to the ids the database returns.
 *
 * @param params - the value being transformed
 * @returns the lower-cased string, anything that is not a string unchanged
 */
const toLowerCase = ({ value }: TransformFnParams): unknown => {
  const raw: unknown = value

  return typeof raw === 'string' ? raw.toLowerCase() : raw
}

/**
 * Validates the id of an account as a UUID and lower-cases it.
 *
 * `@IsUUID()` accepts upper case and the database finds the same account under either spelling, so two spellings of
 * one id must not pass as two accounts.
 *
 * @returns the property decorator
 */
export const IsAccountId = (): ReturnType<typeof applyDecorators> => applyDecorators(Transform(toLowerCase), IsUUID())
