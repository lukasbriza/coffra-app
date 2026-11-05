import { Module } from '@nestjs/common'
import { DiscoveryModule } from '@nestjs/core'

import { OwnershipModule } from '../ownership/ownership.module'

import { UserDeletionService } from './user-deletion.service'
import { UsersController } from './users.controller'
import { UsersService } from './users.service'

/**
 * The users of the app: `GET /api/users/me` and the deletion of the signed-in user.
 *
 * `UsersService` is exported for the authentication, where the callback creates or finds the user. The deletion finds
 * the erasers of the domains through `DiscoveryModule` and builds their owner through `OwnershipModule`. `PrismaModule`
 * is global.
 */
@Module({
  imports: [DiscoveryModule, OwnershipModule],
  controllers: [UsersController],
  providers: [UsersService, UserDeletionService],
  exports: [UsersService],
})
export class UsersModule {}
