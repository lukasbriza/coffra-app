import 'reflect-metadata'

import { Controller, Get, type INestApplication, Logger } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { NextFunction, Request, Response } from 'express'
import request from 'supertest'
import type { App } from 'supertest/types'
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'

import { configureApp } from '../../../../../src/app.setup'
import { CurrentUser } from '../../../../../src/modules/core/auth/decorators/current-user.decorator'
import type { AuthenticatedRequest } from '../../../../../src/modules/core/auth/types'

@Controller('whoami')
class WhoAmIController {
  @Get()
  whoAmI(@CurrentUser() userId: string): { userId: string } {
    return { userId }
  }
}

describe('@CurrentUser()', () => {
  let app: INestApplication
  let error: MockInstance<Logger['error']>

  /** Stands in for `JwtAuthGuard`: sets `auth` on the request, or leaves it unset. */
  const boot = async (auth?: AuthenticatedRequest['auth']): Promise<void> => {
    const moduleRef = await Test.createTestingModule({ controllers: [WhoAmIController] }).compile()
    app = moduleRef.createNestApplication()
    configureApp(app)
    app.use((req: Request, _res: Response, next: NextFunction) => {
      if (auth) {
        ;(req as AuthenticatedRequest).auth = auth
      }
      next()
    })
    await app.init()
  }

  const server = (): App => app.getHttpServer() as App

  beforeEach(() => {
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {
      // keeps the expected error out of the test output
    })
  })

  afterEach(async () => {
    await app.close()
    vi.restoreAllMocks()
  })

  it('returns the user id of the authenticated request', async () => {
    await boot({ userId: 'user-1' })

    await request(server()).get('/api/whoami').expect(200, { userId: 'user-1' })
  })

  it('fails loudly on a request that was never authenticated, instead of handing out undefined', async () => {
    await boot()

    await request(server()).get('/api/whoami').expect(500)

    expect((error.mock.calls[0]?.[0] as Error).message).toContain('@CurrentUser() needs an authenticated request')
  })
})
