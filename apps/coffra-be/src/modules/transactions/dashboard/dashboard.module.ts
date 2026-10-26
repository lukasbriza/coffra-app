import { Module } from '@nestjs/common'

import { TotalsModule } from '../totals/totals.module'

import { DashboardController } from './dashboard.controller'
import { DashboardService } from './dashboard.service'

/**
 * The dashboard of the signed-in user: `/api/dashboard`.
 *
 * It reads the transactions through the totals of the domain, which carry the owner scope, so it needs no ownership
 * layer and no `PrismaService` of its own. Nothing is exported.
 */
@Module({
  imports: [TotalsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
