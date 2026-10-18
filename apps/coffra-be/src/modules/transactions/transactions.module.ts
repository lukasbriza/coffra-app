import { Module } from '@nestjs/common'

import { AccountsModule } from './accounts/accounts.module'

// Each feature of the domain is its own module, wired in here. Categories and transactions land here (T15–T19).
@Module({
  imports: [AccountsModule],
})
export class TransactionsModule {}
