import { Module } from '@nestjs/common'

import { AuthModule } from './auth/auth.module'
import { OwnershipModule } from './ownership/ownership.module'
import { UsersModule } from './users/users.module'

// Each feature of the domain is its own module (auth, users, ownership), wired in here. Other domains import
// `OwnershipModule` from the barrel directly, not this module.
@Module({
  imports: [AuthModule, UsersModule, OwnershipModule],
})
export class CoreModule {}
