import 'reflect-metadata'

import { Controller, Get, Post, Req } from '@nestjs/common'
import type { Request } from 'express'

import { SkipRateLimit, StrictRateLimit } from '../../../src/modules/rate-limit'

// The routes the specs of the rate limit send requests to, one of each kind: they are what `RateLimitModule` is proven
// on, so they use the real decorators and nothing of the app. Shared by the unit specs (`setup.ts`) and by the
// integration specs that run more than one app on the same Redis.

/** Plain routes: the global bucket. */
@Controller('plain')
class PlainController {
  @Get()
  index(): { ok: true } {
    return { ok: true }
  }

  @Get('other')
  other(): { ok: true } {
    return { ok: true }
  }

  /** The address the limit counts for this request, as the application sees it. */
  @Get('who')
  who(@Req() req: Request): { ip: string | undefined } {
    return { ip: req.ip }
  }
}

/** Strict routes: the bucket of the login routes, two handlers to show that they share it. */
@Controller('strict')
@StrictRateLimit()
class StrictController {
  @Get('a')
  first(): { ok: true } {
    return { ok: true }
  }

  @Post('b')
  second(): { ok: true } {
    return { ok: true }
  }
}

/** A route outside the limit, like the health probe. */
@Controller('skipped')
@SkipRateLimit()
class SkippedController {
  @Get()
  index(): { ok: true } {
    return { ok: true }
  }
}

/** All the probe routes, for `controllers` of a testing module. */
export const PROBE_CONTROLLERS = [PlainController, StrictController, SkippedController]
