import { ApiHideProperty, OmitType, PartialType } from '@nestjs/swagger'
import { Equals } from 'class-validator'

import type { UpdateAccountInput } from '../accounts.types'

import { CreateAccountDto } from './create-account.dto'

// `skipNullProperties: false`: a field left out is not changed, but `null` is validated like any other value and
// refused, since every account column is NOT NULL.
export class UpdateAccountDto
  extends PartialType(OmitType(CreateAccountDto, ['currency'] as const), { skipNullProperties: false })
  implements UpdateAccountInput
{
  // Declared only to be refused: the global `whitelist` would otherwise drop it silently and answer 200.
  @ApiHideProperty()
  @Equals(undefined, { message: 'currency cannot be changed after the account is created' })
  currency?: never
}
