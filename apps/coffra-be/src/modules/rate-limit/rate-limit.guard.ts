import { type ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'
import type { Response } from 'express'

import { REDIS_PAUSE_MS } from './constants'

/** `Retry-After` of a `503` caused by Redis, in seconds: the pause after a Redis failure, rounded up. */
const RETRY_AFTER_SECONDS = Math.ceil(REDIS_PAUSE_MS / 1000)

/**
 * The rate limit guard: the `ThrottlerGuard` of `@nestjs/throttler` with one addition.
 *
 * When Redis is down, `FailClosedThrottlerStorage` throws a `503`. This guard adds a `Retry-After` header to it, so the
 * client knows when to try again, the same way the library does for a `429`. Everything else (the limits, the keys,
 * the `X-RateLimit-*` headers) is the library's.
 */
@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  /**
   * Counts the request, or refuses it.
   *
   * @param context - the request
   * @returns `true` when the request is within the limit
   * @throws ThrottlerException over the limit (`429` with `Retry-After`)
   * @throws ServiceUnavailableException while Redis does not answer (`503` with `Retry-After`)
   */
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await super.canActivate(context)
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        const response = context.switchToHttp().getResponse<Response>()
        response.setHeader('Retry-After', String(RETRY_AFTER_SECONDS))
      }

      throw error
    }
  }
}
