import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsUUID, ValidateIf } from 'class-validator'

import { NOTE_MAX_LENGTH } from '../../common/constants'
import { IsIsoDate } from '../../common/decorators/is-iso-date.decorator'
import { IsNote } from '../../common/decorators/is-note.decorator'
import { IsPositiveDecimalAmount } from '../../common/decorators/is-positive-decimal-amount.decorator'
import { INCOME_EXPENSE_TYPES } from '../transactions.constants'
import type { CreateTransactionInput, IncomeExpenseType } from '../transactions.types'

export class CreateTransactionDto implements CreateTransactionInput {
  @ApiProperty({ format: 'uuid', description: 'An account of the signed-in user; the amount is in its currency' })
  @IsUUID()
  accountId!: string

  @ApiProperty({
    enum: [...INCOME_EXPENSE_TYPES],
    enumName: 'IncomeExpenseType',
    description: 'A transfer between own accounts has an API of its own',
  })
  // Not `@IsEnum(TransactionType)`: that would let a transfer in, which this API would store as half a pair.
  @IsIn(INCOME_EXPENSE_TYPES, { message: 'type must be income or expense (a transfer has an API of its own)' })
  type!: IncomeExpenseType

  @ApiProperty({
    description: 'Decimal string greater than zero, at most 4 decimal places; the sign comes from `type`',
    example: '1250.5',
  })
  @IsPositiveDecimalAmount()
  amount!: string

  @ApiProperty({ format: 'date', description: 'Calendar day, no time and no time zone', example: '2026-10-19' })
  @IsIsoDate()
  date!: string

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'A category of the signed-in user; null or left out for none',
  })
  // `null` is a value here: the column is nullable and it means no category.
  @ValidateIf((_dto: unknown, value: unknown) => value !== undefined && value !== null)
  @IsUUID()
  categoryId?: string | null

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: NOTE_MAX_LENGTH,
    description: 'Trimmed; blank or null means no note',
    example: 'Lunch',
  })
  @IsNote()
  note?: string | null
}
