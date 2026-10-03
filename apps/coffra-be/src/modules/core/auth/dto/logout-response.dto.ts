import { ApiProperty } from '@nestjs/swagger'

import type { LogoutRequest } from '../types'

/** Swagger shape of `LogoutRequest`. */
export class LogoutResponseDto implements LogoutRequest {
  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Navigate the browser here to end the session at the identity provider. `null` when the provider has no end-session endpoint.',
  })
  endSessionUrl!: string | null
}
