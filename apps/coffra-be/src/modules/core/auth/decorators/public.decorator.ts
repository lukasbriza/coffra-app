import { applyDecorators, SetMetadata } from '@nestjs/common'
import { ApiSecurity } from '@nestjs/swagger'

import { IS_PUBLIC_KEY } from '../constants'

/**
 * Opens a route (or a whole controller) to requests without an access token: `JwtAuthGuard` lets it through
 * without even reading the `Authorization` header. Every other route is protected by default.
 *
 * Swagger: the empty security requirement overrides the global bearer one, so the route shows no lock.
 */
export const Public = (): ReturnType<typeof applyDecorators> =>
  applyDecorators(SetMetadata(IS_PUBLIC_KEY, true), ApiSecurity({}))
