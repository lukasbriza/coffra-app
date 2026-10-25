import { Module } from '@nestjs/common'

import { OwnershipModule } from '../../core'

import { TransfersController } from './transfers.controller'
import { TransfersService } from './transfers.service'

/**
 * The transfers between own accounts: `/api/transfers`, each a pair of transactions written together.
 *
 * Imports `OwnershipModule` and not `CoreModule`: the domain needs the ownership layer only, not auth. `PrismaModule`
 * is global.
 */
@Module({
  imports: [OwnershipModule],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
