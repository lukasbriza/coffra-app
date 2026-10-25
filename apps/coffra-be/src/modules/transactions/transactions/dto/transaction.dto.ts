import { ApiProperty } from '@nestjs/swagger'

import { TransactionType, TransferDirection } from '../../../prisma'
import type { TransactionView } from '../transactions.types'

/** Swagger shape of `TransactionView`. */
export class TransactionDto implements TransactionView {
  @ApiProperty({ format: 'uuid' })
  id!: string

  @ApiProperty({ format: 'uuid' })
  accountId!: string

  @ApiProperty({ enum: TransactionType, enumName: 'TransactionType' })
  type!: TransactionType

  @ApiProperty({
    description:
      'Positive decimal string with four decimal places, in the currency of the account. The sign comes from `type` and `transferDirection`.',
    example: '1250.5000',
  })
  amount!: string

  @ApiProperty({ format: 'date', description: 'Calendar day', example: '2026-10-19' })
  date!: string

  @ApiProperty({ type: String, nullable: true, example: 'Lunch' })
  note!: string | null

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  categoryId!: string | null

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Shared by both sides of a transfer, null otherwise; the `pairId` of the transfer in `/api/transfers`',
  })
  transferPairId!: string | null

  @ApiProperty({
    enum: TransferDirection,
    enumName: 'TransferDirection',
    nullable: true,
    description: '`out` leaves the account, `in` arrives to it; null outside a transfer',
  })
  transferDirection!: TransferDirection | null
}
