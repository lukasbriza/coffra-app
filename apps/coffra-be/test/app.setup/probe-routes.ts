import 'reflect-metadata'

import { type CanActivate, Controller, Get, Req, UnauthorizedException, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

// The routes the specs of `configureApp` send requests to: one open, one closed, and one that tells the client address.

/** Turns every request away like `JwtAuthGuard` does without a token. */
class DenyGuard implements CanActivate {
  canActivate(): boolean {
    throw new UnauthorizedException()
  }
}

/** An open route: the answer of a healthy request, and the client address as the app sees it. */
@Controller('probe')
export class ProbeController {
  @Get()
  index(): { ok: true } {
    return { ok: true }
  }

  @Get('who')
  who(@Req() req: Request): { ip: string | undefined } {
    return { ip: req.ip }
  }
}

/** A route the guard turns away: the answer of a request without a token. */
@Controller('private')
@UseGuards(DenyGuard)
export class PrivateController {
  @Get()
  index(): { ok: true } {
    return { ok: true }
  }
}
