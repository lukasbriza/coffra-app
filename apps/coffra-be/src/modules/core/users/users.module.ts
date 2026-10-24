import { Module } from '@nestjs/common'

import { UsersController } from './users.controller'
import { UsersService } from './users.service'

/**
 * The users of the app and `GET /api/users/me`.
 *
 * The service is exported for the authentication, where the callback creates or finds the user. `PrismaModule` is
 * global.
 */
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
