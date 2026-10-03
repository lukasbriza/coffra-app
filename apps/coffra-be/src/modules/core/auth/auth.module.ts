import { Module } from '@nestjs/common'

import { AUTH_PROVIDER } from './auth.constants'
import { OidcAuthProvider } from './oidc-auth.provider'

// The controller (T9), token service (T10) and guard (T11) join the provider here.
@Module({
  providers: [{ provide: AUTH_PROVIDER, useClass: OidcAuthProvider }],
  exports: [AUTH_PROVIDER],
})
export class AuthModule {}
