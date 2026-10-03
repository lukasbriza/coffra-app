import { Module } from '@nestjs/common'

import { AuthModule } from './auth/auth.module'

// Each feature of the domain is its own module (auth, later users and ownership: T8, T13), wired in here.
@Module({
  imports: [AuthModule],
})
export class CoreModule {}
