import { Module } from '@nestjs/common'

import { OwnershipModule } from '../../core'

import { TransactionTotalsService } from './totals.service'

/**
 * The totals other domains read: `TransactionTotalsService`, exported through the domain barrel.
 *
 * Imports `OwnershipModule` and not `CoreModule`: the domain needs the ownership layer only, not auth. `PrismaModule`
 * is global.
 */
@Module({
  imports: [OwnershipModule],
  providers: [TransactionTotalsService],
  exports: [TransactionTotalsService],
})
export class TotalsModule {}
