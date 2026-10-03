import { Module } from '@nestjs/common'

import { UsersService } from './users.service'

// Exported for AuthModule (T9: the callback creates or finds the user). `PrismaModule` is global.
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
