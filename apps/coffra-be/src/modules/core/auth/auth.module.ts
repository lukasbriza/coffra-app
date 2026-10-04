import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'

import { UsersModule } from '../users/users.module'

import { AuthChecksService } from './auth-checks.service'
import { AuthTokensService } from './auth-tokens.service'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { AUTH_PROVIDER } from './constants'
import { OidcAuthProvider } from './oidc-auth.provider'

@Module({
  imports: [UsersModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    { provide: AUTH_PROVIDER, useClass: OidcAuthProvider },
    AuthChecksService,
    AuthTokensService,
    AuthService,
  ],
  exports: [AUTH_PROVIDER],
})
export class AuthModule {}
