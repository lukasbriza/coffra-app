import { Module } from '@nestjs/common'

import { AuthModule } from './auth/auth.module'
import { OwnershipModule } from './ownership/ownership.module'
import { UsersModule } from './users/users.module'

/**
 * The foundation the other domains stand on: authentication, users and the ownership layer.
 *
 * Each feature of the domain is its own module, wired in here. Other domains import `OwnershipModule` from the barrel
 * directly, not this module, which would pull in authentication.
 */
@Module({
  imports: [AuthModule, UsersModule, OwnershipModule],
})
export class CoreModule {}
