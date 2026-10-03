import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'

import { UsersModule } from '../users/users.module'

import { AuthChecksService } from './auth-checks.service'
import { AUTH_PROVIDER } from './auth.constants'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { OidcAuthProvider } from './oidc-auth.provider'

// The token service (T10) and guard (T11) join here. `JwtModule` has no default secret: every signed value
// passes its own, so the login checks, access and refresh tokens never share one.
@Module({
  imports: [UsersModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [{ provide: AUTH_PROVIDER, useClass: OidcAuthProvider }, AuthChecksService, AuthService],
  exports: [AUTH_PROVIDER],
})
export class AuthModule {}
