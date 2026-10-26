import { Module } from '@nestjs/common'

import { AccountsModule } from './accounts/accounts.module'
import { CategoriesModule } from './categories/categories.module'
import { DashboardModule } from './dashboard/dashboard.module'
import { TotalsModule } from './totals/totals.module'
import { TransactionsFeatureModule } from './transactions/transactions.module'
import { TransfersModule } from './transfers/transfers.module'

/**
 * The domain of the money: accounts, categories, transactions, transfers and the dashboard of them.
 *
 * Each feature of the domain is its own module, wired in here. Another domain reads the transactions through
 * `TransactionTotalsService`, which this module re-exports.
 */
@Module({
  imports: [
    AccountsModule,
    CategoriesModule,
    DashboardModule,
    TotalsModule,
    TransactionsFeatureModule,
    TransfersModule,
  ],
  exports: [TotalsModule],
})
export class TransactionsModule {}
