import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, Matches, ValidateIf } from 'class-validator'

import { AccountType } from '../../../prisma'
import { RESOURCE_NAME_MAX_LENGTH } from '../../common/constants'
import { IsDecimalAmount } from '../../common/decorators/is-decimal-amount.decorator'
import { IsResourceName } from '../../common/decorators/is-resource-name.decorator'
import type { CreateAccountInput } from '../accounts.types'

/** Body of `POST /api/accounts`. */
export class CreateAccountDto implements CreateAccountInput {
  /** Name of the account; trimmed, not unique. */
  @ApiProperty({ description: 'Trimmed, not unique', example: 'Main account', maxLength: RESOURCE_NAME_MAX_LENGTH })
  @IsResourceName()
  name!: string

  /** Kind of account: a bank account or cash. */
  @ApiProperty({ enum: AccountType, enumName: 'AccountType' })
  @IsEnum(AccountType)
  type!: AccountType

  /**
   * Three capital letters, set on create only.
   *
   * The same rule as the database CHECK `currency_iso`, checked first so that a bad currency is a 400 and not a 500.
   */
  @ApiProperty({
    description: 'Three capital letters (ISO 4217 format, the list itself is not checked). Set on create only.',
    example: 'CZK',
    pattern: '^[A-Z]{3}$',
  })
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be three capital letters' })
  currency!: string

  /**
   * Balance before the first recorded transaction: a decimal string that may be negative.
   *
   * Validated with `ValidateIf` and not `IsOptional`, which would let `null` through to a NOT NULL column.
   */
  @ApiPropertyOptional({
    description: 'Balance before the first recorded transaction: a decimal string, may be negative',
    example: '-1500.25',
    default: '0',
  })
  @ValidateIf((_dto: unknown, value: unknown) => value !== undefined)
  @IsDecimalAmount()
  openingBalance?: string
}
