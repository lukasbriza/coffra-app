import { Controller, Get, Inject, UnauthorizedException } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger'

import { CurrentUser } from '../auth/decorators/current-user.decorator'

import { UserDto } from './dto/user.dto'
import { UsersService } from './users.service'
import type { UserProfile } from './users.types'

/** HTTP layer of the users under `/api/users`: the profile of the signed-in user. */
@Controller('users')
// Swagger
@ApiTags('users')
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  /**
   * `GET /api/users/me`: the user the access token was issued to.
   *
   * @param userId - the user from the access token
   * @returns the id and the email of the user
   * @throws UnauthorizedException when the user was deleted while the access token was still valid (the same answer as
   * a refresh gives)
   */
  @Get('me')
  // Swagger
  @ApiOperation({ summary: 'The user the access token was issued to' })
  @ApiOkResponse({ description: 'The signed-in user', type: UserDto })
  @ApiUnauthorizedResponse({
    description: 'The access token is missing, invalid or expired, or its user no longer exists',
  })
  async me(@CurrentUser() userId: string): Promise<UserProfile> {
    const user = await this.users.findById(userId)

    // Same answer as a refresh: the user was deleted while the access token was still valid.
    if (!user) {
      throw new UnauthorizedException('Invalid or expired access token')
    }

    return { id: user.id, email: user.email }
  }
}
