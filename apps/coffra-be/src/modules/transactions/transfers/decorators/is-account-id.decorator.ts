import { applyDecorators } from '@nestjs/common'
import { Transform, type TransformFnParams } from 'class-transformer'
import { IsUUID } from 'class-validator'

// Postgres compares a `uuid` regardless of letter case, a string comparison does not. Lower-cased, an id compares equal
// to itself however it was spelled, and to the ids the database returns.
const toLowerCase = ({ value }: TransformFnParams): unknown => {
  const raw: unknown = value

  return typeof raw === 'string' ? raw.toLowerCase() : raw
}

/**
 * The id of an account, as a UUID in lower case. `@IsUUID()` accepts upper case and the database finds the same
 * account under either spelling, so two spellings of one id must not pass as two accounts.
 */
export const IsAccountId = (): ReturnType<typeof applyDecorators> => applyDecorators(Transform(toLowerCase), IsUUID())
