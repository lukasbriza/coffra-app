import { ApiHideProperty, ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Equals } from 'class-validator'

import { NOTE_MAX_LENGTH } from '../../common/constants'
import { IsIsoDate } from '../../common/decorators/is-iso-date.decorator'
import { IsNote } from '../../common/decorators/is-note.decorator'
import { IsPositiveDecimalAmount } from '../../common/decorators/is-positive-decimal-amount.decorator'
import { IsAccountId } from '../decorators/is-account-id.decorator'
import { IsDifferentFrom } from '../decorators/is-different-from.decorator'
import type { CreateTransferInput } from '../transfers.types'

export class CreateTransferDto implements CreateTransferInput {
  @ApiProperty({ format: 'uuid', description: 'The account the money leaves: an account of the signed-in user' })
  @IsAccountId()
  fromAccountId!: string

  @ApiProperty({
    format: 'uuid',
    description: 'The account the money arrives to: another account of the signed-in user, in the same currency',
  })
  @IsAccountId()
  @IsDifferentFrom('fromAccountId')
  toAccountId!: string

  @ApiProperty({
    description: 'Decimal string greater than zero, at most 4 decimal places, in the currency of both accounts',
    example: '5000',
  })
  @IsPositiveDecimalAmount()
  amount!: string

  @ApiProperty({ format: 'date', description: 'Calendar day, no time and no time zone', example: '2026-10-21' })
  @IsIsoDate()
  date!: string

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: NOTE_MAX_LENGTH,
    description: 'One note for both transactions; trimmed, blank or null means no note',
    example: 'Savings',
  })
  @IsNote()
  note?: string | null

  // A transfer never has a category. Declared only to be refused, any value and `null` alike: the global `whitelist`
  // would otherwise drop it silently and the client would believe the transfer has one.
  @ApiHideProperty()
  @Equals(undefined, { message: 'a transfer has no category' })
  categoryId?: never
}
