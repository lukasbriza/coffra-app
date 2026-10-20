import { Module } from '@nestjs/common'

import { AccountsModule } from './accounts/accounts.module'
import { CategoriesModule } from './categories/categories.module'
import { TransactionsFeatureModule } from './transactions/transactions.module'

// Each feature of the domain is its own module, wired in here. Transfers and balances land here (T18, T19).
@Module({
  imports: [AccountsModule, CategoriesModule, TransactionsFeatureModule],
})
export class TransactionsModule {}
