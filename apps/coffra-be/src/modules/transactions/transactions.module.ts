import { Module } from '@nestjs/common'

import { AccountsModule } from './accounts/accounts.module'
import { CategoriesModule } from './categories/categories.module'

// Each feature of the domain is its own module, wired in here. Transactions and transfers land here (T16–T19).
@Module({
  imports: [AccountsModule, CategoriesModule],
})
export class TransactionsModule {}
