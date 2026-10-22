import { Module } from '@nestjs/common'

import { OwnershipModule } from '../../core'

import { TransfersController } from './transfers.controller'
import { TransfersService } from './transfers.service'

// `OwnershipModule`, not `CoreModule`: the domain needs the ownership layer only, not auth. `PrismaModule` is global.
@Module({
  imports: [OwnershipModule],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
