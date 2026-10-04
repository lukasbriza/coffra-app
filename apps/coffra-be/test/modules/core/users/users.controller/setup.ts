import 'reflect-metadata'

import { type INestApplication, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Reflector } from '@nestjs/core'
import { JwtModule } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'
import { afterEach, beforeEach, vi } from 'vitest'

import { configureApp } from '../../../../../src/app.setup'
import { AuthTokensService } from '../../../../../src/modules/core/auth/auth-tokens.service'
import { JwtAuthGuard } from '../../../../../src/modules/core/auth/jwt-auth.guard'
import type { TokenPair } from '../../../../../src/modules/core/auth/types'
import { UsersController } from '../../../../../src/modules/core/users/users.controller'
import { UsersService } from '../../../../../src/modules/core/users/users.service'
import { AuthSource, type User } from '../../../../../src/modules/prisma'

// Shared by the use case specs of `UsersController` (one file per endpoint).

export const user: User = {
  id: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11',
  email: 'dev@coffra.local',
  authSource: AuthSource.oidc,
  externalSubject: 'dde84b4e-03ed-4990-a23b-e1be2e5eaf1a',
  createdAt: new Date('2026-10-03T08:00:00Z'),
  updatedAt: new Date('2026-10-03T08:00:00Z'),
}

const values: Record<string, unknown> = {
  JWT_ACCESS_SECRET: 'access-secret-with-at-least-32-chars',
  JWT_REFRESH_SECRET: 'refresh-secret-with-at-least-32-chars',
  JWT_ACCESS_TTL_SECONDS: 900,
  JWT_REFRESH_TTL_SECONDS: 2_592_000,
}

/**
 * Boots the controller behind the real guard and token service, with a mocked `UsersService`. Call it inside a
 * `describe`: it registers the `beforeEach` and `afterEach` for that block.
 */
export const useUsersController = () => {
  const findById = vi.fn<UsersService['findById']>()
  let app: INestApplication

  const server = (): App => app.getHttpServer() as App

  /** A session the guard accepts, issued the way a login does. */
  const session = (userId = user.id): Promise<TokenPair> => app.get(AuthTokensService).issue(userId)

  const me = (authorization?: string): request.Test => {
    const call = request(server()).get('/api/users/me')
    return authorization === undefined ? call : call.set('Authorization', authorization)
  }

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {
      // keeps expected rejection warnings out of the test output
    })
    findById.mockReset().mockResolvedValue(user)

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [UsersController],
      providers: [
        AuthTokensService,
        { provide: UsersService, useValue: { findById } },
        { provide: ConfigService, useValue: { get: (key: string) => values[key] } },
      ],
    }).compile()

    app = moduleRef.createNestApplication()
    configureApp(app)
    app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector), app.get(AuthTokensService))) // as `main.ts` does
    await app.init()
  })

  afterEach(async () => {
    await app.close()
    vi.restoreAllMocks()
  })

  return { findById, server, session, me }
}
