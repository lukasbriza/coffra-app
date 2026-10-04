import 'reflect-metadata'

import { Controller, Get, Global, type INestApplication, Logger, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DiscoveryModule, DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { configureApp } from '../../../src/app.setup'
import { AUTH_PROVIDER, AuthTokensService, CoreModule, JwtAuthGuard } from '../../../src/modules/core'
import { IS_PUBLIC_KEY } from '../../../src/modules/core/auth/constants'
import { UsersService } from '../../../src/modules/core/users/users.service'
import { HealthModule } from '../../../src/modules/health'
import { PrismaService } from '../../../src/modules/prisma'

// The real `CoreModule` and `HealthModule`, wired as in the app: this is where the global guard and the list of
// public routes are proven. Only the outside world is stubbed (config, database, identity provider).

const config: Record<string, unknown> = {
  NODE_ENV: 'development',
  OIDC_ISSUER_URL: 'http://localhost:8080/realms/coffra',
  OIDC_CLIENT_ID: 'coffra-be',
  OIDC_CLIENT_SECRET: 'coffra-dev-secret',
  OIDC_REDIRECT_URI: 'http://localhost:3000/api/auth/callback',
  AUTH_CHECKS_SECRET: 'checks-secret-with-at-least-32-chars',
  JWT_ACCESS_SECRET: 'access-secret-with-at-least-32-chars',
  JWT_REFRESH_SECRET: 'refresh-secret-with-at-least-32-chars',
  JWT_ACCESS_TTL_SECONDS: 900,
  JWT_REFRESH_TTL_SECONDS: 2_592_000,
}

/** The exact public surface of the API. A new public route has to be added here on purpose. */
const PUBLIC_ROUTES = [
  'AuthController.callback',
  'AuthController.login',
  'AuthController.logout',
  'AuthController.refresh',
  'HealthController.check',
]

type Handler = (...args: never[]) => unknown

/** Not public, not part of the app: it exists to have a protected route besides the real ones. */
@Controller('probe')
class ProbeController {
  @Get()
  index(): { ok: true } {
    return { ok: true }
  }
}

@Global()
@Module({
  providers: [{ provide: ConfigService, useValue: { get: (key: string) => config[key] } }],
  exports: [ConfigService],
})
class ConfigStubModule {}

@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: { $queryRaw: () => Promise.resolve([]) } }],
  exports: [PrismaService],
})
class PrismaStubModule {}

describe('the public routes of the API', () => {
  const provider = { login: vi.fn(), validateSession: vi.fn(), getUserInfo: vi.fn(), logout: vi.fn() }
  const users = { findById: vi.fn(), upsertByExternalSubject: vi.fn() }
  let app: INestApplication

  const server = (): App => app.getHttpServer() as App

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {
      // keeps the expected rejection warnings out of the test output
    })
    provider.login.mockReset().mockResolvedValue({
      authorizationUrl: 'http://localhost:8080/realms/coffra/protocol/openid-connect/auth',
      checks: { state: 'state', nonce: 'nonce', codeVerifier: 'verifier' },
    })
    provider.logout.mockReset().mockResolvedValue({ endSessionUrl: null })

    const moduleRef = await Test.createTestingModule({
      imports: [ConfigStubModule, PrismaStubModule, CoreModule, HealthModule, DiscoveryModule],
      controllers: [ProbeController],
    })
      .overrideProvider(AUTH_PROVIDER)
      .useValue(provider)
      .overrideProvider(UsersService)
      .useValue(users)
      .compile()

    app = moduleRef.createNestApplication()
    configureApp(app)
    app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector), app.get(AuthTokensService))) // the line `main.ts` has; the real `CoreModule` has to supply `AuthTokensService`
    await app.init()
  })

  afterEach(async () => {
    await app.close()
    vi.restoreAllMocks()
  })

  describe('the global guard', () => {
    it.each(['/api/probe', '/api/users/me'])('turns %s away without a token', async (path) => {
      const response = await request(server()).get(path).expect(401)

      expect(response.headers['www-authenticate']).toBe('Bearer')
    })
  })

  describe('are reachable without a token', () => {
    // The guard is the only thing that sets `WWW-Authenticate`, so its absence says the guard let the request
    // through, whatever the route then answered (the callback has no cookie here, so it answers 401 itself).
    const cases: [string, () => request.Test, number][] = [
      ['GET /api/auth/login', () => request(server()).get('/api/auth/login'), 302],
      ['GET /api/auth/callback', () => request(server()).get('/api/auth/callback'), 401],
      ['POST /api/auth/refresh', () => request(server()).post('/api/auth/refresh').send({}), 400],
      ['POST /api/auth/logout', () => request(server()).post('/api/auth/logout'), 200],
      ['GET /api/health', () => request(server()).get('/api/health'), 200],
    ]

    it.each(cases)('%s', async (_name, send, status) => {
      const response = await send().expect(status)

      expect(response.headers['www-authenticate']).toBeUndefined()
    })

    it('lets refresh and logout through with an access token that has expired', async () => {
      const expired = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4IiwiZXhwIjoxfQ.invalid'

      const refresh = await request(server()).post('/api/auth/refresh').set('Authorization', expired).send({})
      const logout = await request(server()).post('/api/auth/logout').set('Authorization', expired)

      expect(refresh.status).toBe(400)
      expect(logout.status).toBe(200)
    })
  })

  it('has no public route other than the ones listed here', () => {
    const reflector = app.get(Reflector)
    const scanner = new MetadataScanner()

    const publicRoutes = app
      .get(DiscoveryService)
      .getControllers()
      .flatMap(({ metatype, instance }) => {
        const prototype = Object.getPrototypeOf(instance) as Record<string, Handler>
        const controller = metatype as new (...args: never[]) => unknown

        return scanner
          .getAllMethodNames(prototype)
          .filter((method) => Reflect.hasMetadata('path', prototype[method]))
          .filter((method) =>
            reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [prototype[method], controller]),
          )
          .map((method) => `${controller.name}.${method}`)
      })

    expect(publicRoutes.toSorted()).toEqual(PUBLIC_ROUTES)
  })
})
