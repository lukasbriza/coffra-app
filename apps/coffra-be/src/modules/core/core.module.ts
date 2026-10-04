import { Module } from '@nestjs/common'

import { AuthModule } from './auth/auth.module'
import { UsersModule } from './users/users.module'

// Each feature of the domain is its own module (auth, users, later ownership: T13), wired in here.
@Module({
  imports: [AuthModule, UsersModule],
})
export class CoreModule {}
