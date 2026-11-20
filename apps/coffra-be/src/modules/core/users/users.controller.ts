import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, UnauthorizedException } from '@nestjs/common'
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger'

import { CurrentUser } from '../auth/decorators/current-user.decorator'

import { ConfirmDeletionDto } from './dto/confirm-deletion.dto'
import { UserDto } from './dto/user.dto'
import { UserDeletionService } from './user-deletion.service'
import { UsersService } from './users.service'
import type { UserProfile } from './users.types'

/** The answer of a token whose user no longer exists, shared by both routes. */
const UNAUTHORIZED = { description: 'The access token is missing, invalid or expired, or its user no longer exists' }

/** HTTP layer of the users under `/api/users`: the profile of the signed-in user and the deletion of their account. */
@Controller('users')
// Swagger
@ApiTags('users')
export class UsersController {
  constructor(
    @Inject(UsersService) private readonly users: UsersService,
    @Inject(UserDeletionService) private readonly deletion: UserDeletionService,
  ) {}

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
  @ApiUnauthorizedResponse(UNAUTHORIZED)
  async me(@CurrentUser() userId: string): Promise<UserProfile> {
    const user = await this.users.findById(userId)

    // Same answer as a refresh: the user was deleted while the access token was still valid.
    if (!user) {
      throw new UnauthorizedException('Invalid or expired access token')
    }

    return { id: user.id, email: user.email }
  }

  /**
   * `POST /api/users/me/deletion`: deletes the signed-in user and everything they own.
   *
   * The user comes from the access token, never from the body; the body only confirms it. A `POST`, not a `DELETE`
   * with a body: OpenAPI 3.0 tells clients to ignore the body of a `DELETE`.
   *
   * @param userId - the user from the access token
   * @param body - the confirmation, the email of the user
   * @returns nothing (`204`)
   * @throws UnauthorizedException when the user no longer exists
   * @throws ConflictException when the confirmation is not the email of the user
   */
  @Post('me/deletion')
  @HttpCode(HttpStatus.NO_CONTENT)
  // Swagger
  @ApiOperation({
    summary: 'Delete the signed-in user and everything they own',
    description:
      'Deletes the accounts, categories, transactions and transfers of the user and the user, at once and for good. ' +
      'The access token keeps working until it expires but finds nothing, and the refresh token is refused. ' +
      'Afterwards the client drops both tokens and logs out at the identity provider (`POST /api/auth/logout`, then ' +
      'the browser goes to `endSessionUrl`); otherwise the next login signs in again without a password. The identity ' +
      'at the provider stays: logging in again creates a new, empty user.',
  })
  @ApiNoContentResponse({ description: 'The user and all their data are deleted' })
  @ApiBadRequestResponse({ description: '`confirm` is missing, empty, not a string or longer than 320 characters' })
  @ApiConflictResponse({ description: '`confirm` is not the email of the user: nothing was deleted' })
  @ApiUnauthorizedResponse(UNAUTHORIZED)
  async deleteMe(@CurrentUser() userId: string, @Body() body: ConfirmDeletionDto): Promise<void> {
    await this.deletion.delete(userId, body)
  }
}
