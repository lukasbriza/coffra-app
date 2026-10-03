import { Module } from '@nestjs/common'

import { AppConfigModule } from './modules/config'
import { CoreModule } from './modules/core'
import { DashboardModule } from './modules/dashboard'
import { HealthModule } from './modules/health'
import { PrismaModule } from './modules/prisma'
import { TransactionsModule } from './modules/transactions'

@Module({
  imports: [AppConfigModule, PrismaModule, HealthModule, CoreModule, TransactionsModule, DashboardModule],
})
export class AppModule {}
