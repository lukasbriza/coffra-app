import { describe, expect, it } from 'vitest'

import { AuthController } from '../../../src/modules/core/auth/auth.controller'
import { STRICT_RATE_LIMIT } from '../../../src/modules/rate-limit/constants'

// Which routes of the app are in the strict bucket. `e2e/auth/rate-limit.spec.ts` proves it through the whole app;
// this is the short list a reviewer reads: a route that opens the way to the account is strict, and only those.

describe('the strict routes of the app', () => {
  it('are all the routes of AuthController, as a whole class, so a route added there is strict too', () => {
    expect(Reflect.getMetadata(STRICT_RATE_LIMIT, AuthController)).toBe(true)
  })

  it('are not marked on the handlers one by one: the class is the one place that says it', () => {
    const handlers = ['login', 'callback', 'refresh', 'logout'] as const

    for (const handler of handlers) {
      expect(Reflect.getMetadata(STRICT_RATE_LIMIT, AuthController.prototype[handler]), handler).toBeUndefined()
    }
  })
})
