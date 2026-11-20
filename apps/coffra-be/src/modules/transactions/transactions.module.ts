import { Module } from '@nestjs/common'

import { AccountsModule } from './accounts/accounts.module'
import { CategoriesModule } from './categories/categories.module'
import { DashboardModule } from './dashboard/dashboard.module'
import { ErasureModule } from './erasure/erasure.module'
import { TotalsModule } from './totals/totals.module'
import { TransactionsFeatureModule } from './transactions/transactions.module'
import { TransfersModule } from './transfers/transfers.module'

/**
 * The domain of the money: accounts, categories, transactions, transfers and the dashboard of them.
 *
 * Each feature of the domain is its own module, wired in here. Another domain reads the transactions through
 * `TransactionTotalsService`, which this module re-exports. The deletion of a user in `core` erases the data of the
 * domain through the `@OwnerDataEraser()` of `ErasureModule`.
 */
@Module({
  imports: [
    AccountsModule,
    CategoriesModule,
    DashboardModule,
    ErasureModule,
    TotalsModule,
    TransactionsFeatureModule,
    TransfersModule,
  ],
  exports: [TotalsModule],
})
export class TransactionsModule {}
