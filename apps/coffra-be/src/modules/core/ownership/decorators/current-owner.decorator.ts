import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

import type { AuthenticatedRequest } from '../../auth/types'
import type { Owner } from '../ownership.types'

/**
 * Injects whose data the request works with, for every route that reads or writes domain data.
 *
 * Only for routes that are not `@Public()`. `@CurrentUser()` stays for the identity of the caller
 * (`GET /api/users/me`).
 *
 * @throws Error on a `@Public()` route or when the guard is not registered: a programming error, so it fails loudly
 * instead of handing out an owner without a user
 */
export const CurrentOwner = createParamDecorator((_data: unknown, context: ExecutionContext): Owner => {
  const { auth } = context.switchToHttp().getRequest<AuthenticatedRequest>()

  if (!auth) {
    // A programming error, same as `@CurrentUser()`: fail loudly, never hand out an owner without a user.
    throw new Error('@CurrentOwner() needs an authenticated request: is the route @Public()?')
  }

  return { userId: auth.userId }
})
