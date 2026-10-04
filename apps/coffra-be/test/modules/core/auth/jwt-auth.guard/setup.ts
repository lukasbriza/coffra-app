import 'reflect-metadata'

import { Controller, Get, type INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { JwtModule, JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'
import { afterEach, beforeEach, vi } from 'vitest'

import { configureApp } from '../../../../../src/app.setup'
import { AuthTokensService } from '../../../../../src/modules/core/auth/auth-tokens.service'
import { CurrentUser } from '../../../../../src/modules/core/auth/decorators/current-user.decorator'
import { Public } from '../../../../../src/modules/core/auth/decorators/public.decorator'
import { JwtAuthGuard } from '../../../../../src/modules/core/auth/jwt-auth.guard'
import { useQuietWarnings } from '../use-quiet-warnings'

// Shared by the use case specs of `JwtAuthGuard`: the real guard and token service in front of probe routes.

export const ACCESS_SECRET = 'access-secret-with-at-least-32-chars'
export const REFRESH_SECRET = 'refresh-secret-with-at-least-32-chars'
export const CHECKS_SECRET = 'checks-secret-with-at-least-32-chars'
export const USER_ID = '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11'
export const REJECTION_MESSAGE = 'Invalid or expired access token'

/** Called by the probe handlers, so a spec can tell whether the guard let the request through. */
export const handler = vi.fn<(userId?: string) => void>()

@Controller('probe')
class ProbeController {
  @Get()
  protectedRoute(@CurrentUser() userId: string): { userId: string } {
    handler(userId)
    return { userId }
  }

  @Public()
  @Get('open')
  openRoute(): { open: true } {
    handler()
    return { open: true }
  }
}

@Public()
@Controller('open-class')
class OpenClassController {
  @Get()
  index(): { open: true } {
    handler()
    return { open: true }
  }
}

const values: Record<string, unknown> = {
  JWT_ACCESS_SECRET: ACCESS_SECRET,
  JWT_REFRESH_SECRET: REFRESH_SECRET,
  JWT_ACCESS_TTL_SECONDS: 900,
  JWT_REFRESH_TTL_SECONDS: 2_592_000,
}

export const nowSeconds = (): number => Math.floor(Date.now() / 1000)
export const base64Url = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url')

/**
 * Boots the probe routes behind the guard, with the real `AuthTokensService`. Call it inside a `describe`: it
 * registers the `beforeEach` and `afterEach` for that block and silences the expected rejection warnings.
 */
export const useJwtAuthGuard = () => {
  const { warn } = useQuietWarnings()
  let app: INestApplication

  const server = (): App => app.getHttpServer() as App
  const jwt = (): JwtService => app.get(JwtService)

  /** An access token the guard accepts. */
  const accessToken = (userId = USER_ID): Promise<string> =>
    jwt().signAsync({ sub: userId }, { secret: ACCESS_SECRET, expiresIn: 900 })

  const get = (path: string, authorization?: string): request.Test => {
    const call = request(server()).get(path)
    return authorization === undefined ? call : call.set('Authorization', authorization)
  }

  beforeEach(async () => {
    handler.mockReset()

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [ProbeController, OpenClassController],
      providers: [AuthTokensService, { provide: ConfigService, useValue: { get: (key: string) => values[key] } }],
    }).compile()

    app = moduleRef.createNestApplication()
    configureApp(app)
    app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector), app.get(AuthTokensService))) // as `main.ts` does
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  return {
    warn,
    server,
    jwt,
    accessToken,
    get,
    /** The running app, e.g. for `get(AuthTokensService)`. */
    application: (): INestApplication => app,
  }
}
