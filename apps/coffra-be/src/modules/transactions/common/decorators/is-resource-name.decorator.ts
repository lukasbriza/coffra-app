import { applyDecorators } from '@nestjs/common'
import { Transform, type TransformFnParams } from 'class-transformer'
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

import { RESOURCE_NAME_MAX_LENGTH } from '../constants'

/**
 * Trims a string.
 *
 * @param params - the value being transformed
 * @returns the trimmed string, anything that is not a string unchanged
 */
const trim = ({ value }: TransformFnParams): unknown => {
  const raw: unknown = value
  return typeof raw === 'string' ? raw.trim() : raw
}

/**
 * Validates the name of an account or a category: trimmed first, so `"Food "` and `"Food"` are one name and a blank
 * name is empty, then a non-empty string of at most 100 characters.
 *
 * @returns the property decorator
 */
export const IsResourceName = (): ReturnType<typeof applyDecorators> =>
  applyDecorators(Transform(trim), IsString(), IsNotEmpty(), MaxLength(RESOURCE_NAME_MAX_LENGTH))
