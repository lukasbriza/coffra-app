import { ApiProperty } from '@nestjs/swagger'

import type { TransferView } from '../transfers.types'

/** Swagger shape of `TransferView`. */
export class TransferDto implements TransferView {
  @ApiProperty({
    format: 'uuid',
    description: 'Id of the transfer: the `transferPairId` of both of its transactions in `/api/transactions`',
  })
  pairId!: string

  @ApiProperty({ format: 'uuid', description: 'The account the money leaves (the `out` transaction)' })
  fromAccountId!: string

  @ApiProperty({ format: 'uuid', description: 'The account the money arrives to (the `in` transaction)' })
  toAccountId!: string

  @ApiProperty({
    description: 'Positive decimal string with four decimal places, in the currency of both accounts',
    example: '5000.0000',
  })
  amount!: string

  @ApiProperty({ format: 'date', description: 'Calendar day', example: '2026-10-21' })
  date!: string

  @ApiProperty({ type: String, nullable: true, description: 'One note for both transactions', example: 'Savings' })
  note!: string | null
}
