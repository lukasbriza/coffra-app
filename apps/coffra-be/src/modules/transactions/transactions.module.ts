import { Module } from '@nestjs/common'

import { AccountsModule } from './accounts/accounts.module'
import { CategoriesModule } from './categories/categories.module'
import { TransactionsFeatureModule } from './transactions/transactions.module'
import { TransfersModule } from './transfers/transfers.module'

/**
 * The domain of the money: accounts, categories, transactions and transfers.
 *
 * Each feature of the domain is its own module, wired in here.
 */
@Module({
  imports: [AccountsModule, CategoriesModule, TransactionsFeatureModule, TransfersModule],
})
export class TransactionsModule {}
