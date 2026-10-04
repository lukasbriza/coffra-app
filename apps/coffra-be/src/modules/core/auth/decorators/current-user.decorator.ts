import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

import type { AuthenticatedRequest } from '../types'

/** The id of the user the access token was issued to (`User.id`). Only for routes that are not `@Public()`. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): string => {
  const { auth } = context.switchToHttp().getRequest<AuthenticatedRequest>()

  if (!auth) {
    // A programming error (a `@Public()` route, or the guard is not registered): fail loudly, never hand out `undefined`.
    throw new Error('@CurrentUser() needs an authenticated request: is the route @Public()?')
  }

  return auth.userId
})
