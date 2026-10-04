import { Controller, Get, Inject, UnauthorizedException } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger'

import { CurrentUser } from '../auth/decorators/current-user.decorator'

import { UserDto } from './dto/user.dto'
import { UsersService } from './users.service'
import type { UserProfile } from './users.types'

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get('me')
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
