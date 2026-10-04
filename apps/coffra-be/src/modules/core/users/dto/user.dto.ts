import { ApiProperty } from '@nestjs/swagger'

import type { UserProfile } from '../users.types'

/** Swagger shape of `UserProfile`. */
export class UserDto implements UserProfile {
  @ApiProperty({ description: 'The user id, the `sub` claim of the access token', format: 'uuid' })
  id!: string

  @ApiProperty({ description: 'Email as the identity provider reported it at the last login' })
  email!: string
}
