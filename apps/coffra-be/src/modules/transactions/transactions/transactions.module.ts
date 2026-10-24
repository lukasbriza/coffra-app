import { Module } from '@nestjs/common'

import { OwnershipModule } from '../../core'

import { TransactionsController } from './transactions.controller'
import { TransactionsService } from './transactions.service'

/**
 * Income and expense: `/api/transactions`, including the list with filters and a cursor.
 *
 * Named `TransactionsFeatureModule` because `TransactionsModule` is the module of the whole domain
 * (`../transactions.module.ts`). Imports `OwnershipModule` and not `CoreModule`: the domain needs the ownership layer
 * only, not auth. `PrismaModule` is global.
 */
@Module({
  imports: [OwnershipModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsFeatureModule {}
