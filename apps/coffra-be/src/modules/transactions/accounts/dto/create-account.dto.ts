import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, Matches, ValidateIf } from 'class-validator'

import { AccountType } from '../../../prisma'
import { RESOURCE_NAME_MAX_LENGTH } from '../../common/constants'
import { IsDecimalAmount } from '../../common/decorators/is-decimal-amount.decorator'
import { IsResourceName } from '../../common/decorators/is-resource-name.decorator'
import type { CreateAccountInput } from '../accounts.types'

export class CreateAccountDto implements CreateAccountInput {
  @ApiProperty({ description: 'Trimmed, not unique', example: 'Main account', maxLength: RESOURCE_NAME_MAX_LENGTH })
  @IsResourceName()
  name!: string

  @ApiProperty({ enum: AccountType, enumName: 'AccountType' })
  @IsEnum(AccountType)
  type!: AccountType

  @ApiProperty({
    description: 'Three capital letters (ISO 4217 format, the list itself is not checked). Set on create only.',
    example: 'CZK',
    pattern: '^[A-Z]{3}$',
  })
  // The same rule as the database CHECK `currency_iso`, checked first so a bad currency is a 400, not a 500.
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be three capital letters' })
  currency!: string

  @ApiPropertyOptional({
    description: 'Balance before the first recorded transaction: a decimal string, may be negative',
    example: '-1500.25',
    default: '0',
  })
  // Not `@IsOptional()`: that would let `null` through to a NOT NULL column.
  @ValidateIf((_dto: unknown, value: unknown) => value !== undefined)
  @IsDecimalAmount()
  openingBalance?: string
}
