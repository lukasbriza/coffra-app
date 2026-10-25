import { Module } from '@nestjs/common'

import { AppConfigModule } from './modules/config'
import { CoreModule } from './modules/core'
import { DashboardModule } from './modules/dashboard'
import { HealthModule } from './modules/health'
import { PrismaModule } from './modules/prisma'
import { TransactionsModule } from './modules/transactions'

/**
 * Root module of the API.
 *
 * Wires the infrastructure (configuration, database, health probe) and the domains: `core` (auth, users, ownership),
 * `transactions` and `dashboard`. A domain is imported through its `index.ts` only.
 */
@Module({
  imports: [AppConfigModule, PrismaModule, HealthModule, CoreModule, TransactionsModule, DashboardModule],
})
export class AppModule {}
