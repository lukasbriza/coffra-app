import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'

import { CONFIRMATION_MAX_LENGTH } from '../constants'
import type { DeleteUserInput } from '../users.types'

/** Body of `POST /api/users/me/deletion`. */
export class ConfirmDeletionDto implements DeleteUserInput {
  @ApiProperty({
    description:
      'The email of the signed-in user, exactly as `GET /api/users/me` returns it (letter case included). Anything else ' +
      'is a 409 and deletes nothing.',
    example: 'dev@coffra.local',
    minLength: 1,
    maxLength: CONFIRMATION_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(CONFIRMATION_MAX_LENGTH)
  confirm!: string
}
