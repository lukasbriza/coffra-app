import { ApiProperty } from '@nestjs/swagger'

import type { TokenPair } from '../types'

/** Swagger shape of `TokenPair`. */
export class TokenPairDto implements TokenPair {
  @ApiProperty({ description: 'Short-lived JWT for the `Authorization: Bearer` header' })
  accessToken!: string

  @ApiProperty({ description: 'JWT for `POST /api/auth/refresh` only, never accepted as an access token' })
  refreshToken!: string

  @ApiProperty({ description: 'Lifetime of the access token in seconds', example: 900 })
  expiresIn!: number
}
