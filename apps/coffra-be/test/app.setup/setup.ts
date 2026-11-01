import 'reflect-metadata'

import {
  type CanActivate,
  Controller,
  Get,
  type INestApplication,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { Request } from 'express'
import request from 'supertest'
import type { App } from 'supertest/types'
import { afterEach, beforeEach } from 'vitest'

import { configureApp } from '../../src/app.setup'
import type { AppOptions } from '../../src/app.types'
import { setupSwagger } from '../../src/swagger.setup'

// Shared by the specs of `configureApp` and `setupSwagger`: an application with one open and one closed probe route,
// configured exactly as `main.ts` does, and nothing else of the app.

/** Turns every request away like `JwtAuthGuard` does without a token. */
class DenyGuard implements CanActivate {
  canActivate(): boolean {
    throw new UnauthorizedException()
  }
}

/** An open route: the answer of a healthy request. */
@Controller('probe')
class ProbeController {
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
class PrivateController {
  @Get()
  index(): { ok: true } {
    return { ok: true }
  }
}

/** What a spec may add to the app it boots. */
type HttpAppOptions = { swagger?: boolean }

/**
 * Boots the probe routes with `configureApp(app, options)`. Call it inside a `describe`: it registers the
 * `beforeEach` and `afterEach` of that block and returns the requests of the specs.
 *
 * @param options - what `main.ts` would take from the environment
 * @param extras - `swagger: true` also mounts the Swagger UI (`setupSwagger`), as `main.ts` does
 */
export const useHttpApp = (options: AppOptions = {}, { swagger = false }: HttpAppOptions = {}) => {
  let app: INestApplication

  const server = (): App => app.getHttpServer() as App

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [ProbeController, PrivateController] }).compile()

    app = moduleRef.createNestApplication()
    configureApp(app, options)
    if (swagger) {
      setupSwagger(app)
    }
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  return {
    get: (path: string, headers: Record<string, string> = {}): request.Test => request(server()).get(path).set(headers),
    options: (path: string, headers: Record<string, string> = {}): request.Test =>
      request(server()).options(path).set(headers),
  }
}
