import 'reflect-metadata'

import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import type { App } from 'supertest/types'
import { afterEach, beforeEach, vi } from 'vitest'

import { configureApp } from '../../src/app.setup'
import type { AppOptions } from '../../src/app.types'
import { HealthModule } from '../../src/modules/health'
import { PrismaService } from '../../src/modules/prisma/prisma.service'
import { RedisService } from '../../src/modules/redis'
import { setupSwagger } from '../../src/swagger.setup'

import { EchoController } from './echo-route'
import { PrivateController, ProbeController } from './probe-routes'

// Shared by the specs of `configureApp` and `setupSwagger` (one spec per use case in this folder): the probe routes,
// the echo route and the real health probe, configured exactly as `main.ts` does, and nothing else of the app. The
// database and Redis of the health probe are mocks the specs control.

/** The outside world of the health probe; reset before every test to "up". */
export const infrastructure = {
  queryRaw: vi.fn(),
  ping: vi.fn(),
}

/**
 * What a spec boots.
 *
 * @property swagger - also mount the Swagger UI (`setupSwagger`), as `main.ts` does when `SWAGGER_ENABLED`
 */
type HttpAppOptions = AppOptions & { swagger?: boolean }

/**
 * Boots the routes with `configureApp`. Call it inside a `describe`: it registers the `beforeEach` and `afterEach` of
 * that block and returns the requests of the specs.
 *
 * @param options - what `main.ts` would take from the environment (`corsOrigins`, `trustProxyHops`), and `swagger`
 */
export const useHttpApp = ({ swagger = false, ...appOptions }: HttpAppOptions = {}) => {
  let app: INestApplication

  const server = (): App => app.getHttpServer() as App

  beforeEach(async () => {
    infrastructure.queryRaw.mockReset().mockResolvedValue([])
    infrastructure.ping.mockReset().mockResolvedValue('PONG')

    // The health probe needs `PrismaService` and `RedisService`; no module of this app provides them.
    const mocks = new Map<unknown, unknown>([
      [PrismaService, { $queryRaw: infrastructure.queryRaw }],
      [RedisService, { ping: infrastructure.ping }],
    ])
    const moduleRef = await Test.createTestingModule({
      imports: [HealthModule],
      controllers: [ProbeController, PrivateController, EchoController],
    })
      .useMocker((token) => mocks.get(token))
      .compile()

    app = moduleRef.createNestApplication()
    configureApp(app, appOptions)
    if (swagger) {
      setupSwagger(app)
    }
    await app.init()
  })

  afterEach(async () => {
    await app.close()
    vi.restoreAllMocks()
  })

  return {
    /** The app, for `buildSwaggerDocument`. */
    app: (): INestApplication => app,
    get: (path: string, headers: Record<string, string> = {}): request.Test => request(server()).get(path).set(headers),
    post: (path: string, body: object): request.Test => request(server()).post(path).send(body),
    options: (path: string, headers: Record<string, string> = {}): request.Test =>
      request(server()).options(path).set(headers),
  }
}
