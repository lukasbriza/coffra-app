import { applyDecorators } from '@nestjs/common'
import { Transform, type TransformFnParams } from 'class-transformer'
import { IsString, MaxLength, ValidateIf } from 'class-validator'

import { NOTE_MAX_LENGTH } from '../constants'

/**
 * Trims a note, and turns a blank one into `null`, so "no note" is stored one way only.
 *
 * @param params - the value being transformed
 * @returns the trimmed string, `null` for a blank one, anything that is not a string unchanged
 */
const trimToNull = ({ value }: TransformFnParams): unknown => {
  const raw: unknown = value

  if (typeof raw !== 'string') {
    return raw
  }

  const trimmed = raw.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Validates an optional free-text note: trimmed, at most 500 characters.
 *
 * `null` and a blank string mean no note (the column is nullable), so a `PATCH` with either clears it.
 *
 * @returns the property decorator
 */
export const IsNote = (): ReturnType<typeof applyDecorators> =>
  applyDecorators(
    Transform(trimToNull),
    ValidateIf((_dto: unknown, value: unknown) => value !== undefined && value !== null),
    IsString(),
    MaxLength(NOTE_MAX_LENGTH),
  )
