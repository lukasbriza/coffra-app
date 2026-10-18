import { applyDecorators } from '@nestjs/common'
import { Transform, type TransformFnParams } from 'class-transformer'
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

import { RESOURCE_NAME_MAX_LENGTH } from '../constants'

const trim = ({ value }: TransformFnParams): unknown => {
  const raw: unknown = value
  return typeof raw === 'string' ? raw.trim() : raw
}

/**
 * The name of an account or a category: trimmed first, so `"Food "` and `"Food"` are one name and a blank name is
 * empty, then a non-empty string of at most 100 characters.
 */
export const IsResourceName = (): ReturnType<typeof applyDecorators> =>
  applyDecorators(Transform(trim), IsString(), IsNotEmpty(), MaxLength(RESOURCE_NAME_MAX_LENGTH))
