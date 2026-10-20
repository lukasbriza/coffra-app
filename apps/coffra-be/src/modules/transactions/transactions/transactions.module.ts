import { Module } from '@nestjs/common'

import { OwnershipModule } from '../../core'

import { TransactionsController } from './transactions.controller'
import { TransactionsService } from './transactions.service'

// Not `TransactionsModule`: that name is the module of the whole domain (`../transactions.module.ts`).
// `OwnershipModule`, not `CoreModule`: the domain needs the ownership layer only, not auth. `PrismaModule` is global.
@Module({
  imports: [OwnershipModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsFeatureModule {}
