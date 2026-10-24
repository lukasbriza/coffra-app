import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString } from 'class-validator'

/** Body of `POST /api/auth/refresh`. */
export class RefreshTokenDto {
  @ApiProperty({ description: 'The refresh token from the callback or the previous refresh' })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string
}
