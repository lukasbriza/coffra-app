import { Module } from '@nestjs/common'

import { OwnershipModule } from '../../core'

import { AccountsController } from './accounts.controller'
import { AccountsService } from './accounts.service'

// `OwnershipModule`, not `CoreModule`: the domain needs the ownership layer only, not auth. `PrismaModule` is global.
@Module({
  imports: [OwnershipModule],
  controllers: [AccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
