import 'reflect-metadata'

import { type INestApplication, Logger, type Type } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'
import { afterEach, beforeEach, type Mock, vi } from 'vitest'

import { configureApp } from '../../../src/app.setup'
import { AuthTokensService } from '../../../src/modules/core/auth/auth-tokens.service'
import { JwtAuthGuard } from '../../../src/modules/core/auth/jwt-auth.guard'

// Shared by the controller specs of `transactions` (one folder per controller): one controller behind the real guard
// and the real global `ValidationPipe` (`configureApp`), its service replaced by a mock. The `setup.ts` of each folder
// holds the mock, the fixtures and the ids; what the service does is in its own specs.

export const USER_ID = '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11'

/** The owner `@CurrentOwner()` hands to the service for a token of `USER_ID`. */
export const OWNER = { userId: USER_ID }

const values: Record<string, unknown> = {
  JWT_ACCESS_SECRET: 'access-secret-with-at-least-32-chars',
  JWT_REFRESH_SECRET: 'refresh-secret-with-at-least-32-chars',
  JWT_ACCESS_TTL_SECONDS: 900,
  JWT_REFRESH_TTL_SECONDS: 2_592_000,
}

type Method = 'get' | 'post' | 'patch' | 'delete'

/**
 * Boots `controller` with `service` provided by `mock`, behind the real guard. Call it inside a `describe`, after the
 * `beforeEach` that resets the mock: it registers the `beforeEach` and `afterEach` for that block.
 */
export const useControllerApp = (controller: Type, service: Type, mock: Record<string, Mock>) => {
  let app: INestApplication
  let authorization = ''

  const server = (): App => app.getHttpServer() as App

  /** A request signed in as `USER_ID`. */
  const send = (method: Method, path: string, body?: object): request.Test => {
    const call = request(server())[method](path).set('Authorization', authorization)
    return body === undefined ? call : call.send(body)
  }

  /** The same request without a token. */
  const anonymous = (method: Method, path: string): request.Test => request(server())[method](path)

  /** Every service method, to assert that none ran. */
  const calls = (): number => Object.values(mock).reduce((sum, method) => sum + method.mock.calls.length, 0)

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {
      // keeps the expected rejection warnings out of the test output
    })

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [controller],
      providers: [
        AuthTokensService,
        { provide: service, useValue: mock },
        { provide: ConfigService, useValue: { get: (key: string) => values[key] } },
      ],
    }).compile()

    app = moduleRef.createNestApplication()
    configureApp(app)
    app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector), app.get(AuthTokensService))) // as `main.ts` does
    await app.init()

    const { accessToken } = await app.get(AuthTokensService).issue(USER_ID)
    authorization = `Bearer ${accessToken}`
  })

  afterEach(async () => {
    await app.close()
    vi.restoreAllMocks()
  })

  return { send, anonymous, calls }
}
