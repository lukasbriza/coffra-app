import { ApiHideProperty, OmitType, PartialType } from '@nestjs/swagger'
import { Equals } from 'class-validator'

import type { UpdateAccountInput } from '../accounts.types'

import { CreateAccountDto } from './create-account.dto'

/**
 * Body of `PATCH /api/accounts/:id`: any field of a create except the currency.
 *
 * `skipNullProperties: false` makes a field that is left out stay as it is, while `null` is validated like any other
 * value and refused, since every account column is NOT NULL.
 */
export class UpdateAccountDto
  extends PartialType(OmitType(CreateAccountDto, ['currency'] as const), { skipNullProperties: false })
  implements UpdateAccountInput
{
  /**
   * The currency, declared only to be refused.
   *
   * The global `whitelist` would otherwise drop it silently and the request would answer 200.
   */
  @ApiHideProperty()
  @Equals(undefined, { message: 'currency cannot be changed after the account is created' })
  currency?: never
}
