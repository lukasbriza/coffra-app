import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

import type { AuthenticatedRequest } from '../types'

/**
 * Injects the id of the user the access token was issued to (`User.id`).
 *
 * Only for routes that are not `@Public()`. It identifies the caller; for the data of a request use
 * `@CurrentOwner()` instead.
 *
 * @throws Error on a `@Public()` route or when the guard is not registered: a programming error, so it fails loudly
 * instead of handing out `undefined`
 */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const { auth } = context.switchToHttp().getRequest<AuthenticatedRequest>()

  if (!auth) {
    // A programming error (a `@Public()` route, or the guard is not registered): fail loudly, never hand out `undefined`.
    throw new Error('@CurrentUser() needs an authenticated request: is the route @Public()?')
  }

  return auth.userId
})
