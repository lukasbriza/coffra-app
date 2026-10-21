import { ApiProperty } from '@nestjs/swagger'

import type { TransactionPage } from '../transactions.types'

import { TransactionDto } from './transaction.dto'

/** Swagger shape of `TransactionPage`. */
export class TransactionPageDto implements TransactionPage {
  @ApiProperty({ type: [TransactionDto], description: 'In the requested order; empty when nothing matches' })
  items!: TransactionDto[]

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Pass as `cursor`, with the same `order` and filters, for the next page; null on the last page',
  })
  nextCursor!: string | null
}
