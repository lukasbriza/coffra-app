import { Module } from '@nestjs/common'

import { OwnershipModule } from '../../core'

import { TransactionsDataEraser } from './transactions-data.eraser'

/**
 * The part of the domain the deletion of a user calls: `TransactionsDataEraser`.
 *
 * Nothing is exported: `core` finds the eraser through `@OwnerDataEraser()` as long as this module is part of the app.
 */
@Module({
  imports: [OwnershipModule],
  providers: [TransactionsDataEraser],
})
export class ErasureModule {}
