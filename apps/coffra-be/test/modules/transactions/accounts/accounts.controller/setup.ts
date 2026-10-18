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
import { AccountType } from '../../../../../src/modules/prisma'
import { AccountsController } from '../../../../../src/modules/transactions/accounts/accounts.controller'
import { AccountsService } from '../../../../../src/modules/transactions/accounts/accounts.service'
import type { AccountView } from '../../../../../src/modules/transactions/accounts/accounts.types'

// Shared by the use case specs of `AccountsController` (one file per endpoint): the real guard, the real global
// `ValidationPipe` (`configureApp`) and a mocked `AccountsService`. What the service does is in its own specs.

export const USER_ID = '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11'
export const ACCOUNT_ID = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d'

/** The owner `@CurrentOwner()` hands to the service for a token of `USER_ID`. */
export const OWNER = { userId: USER_ID }

export const VIEW: AccountView = {
  id: ACCOUNT_ID,
  name: 'Main account',
  type: AccountType.bank,
  currency: 'CZK',
  openingBalance: '1250.5000',
}

/** A create body that passes validation; specs override one field at a time. */
export const VALID_BODY = { name: 'Main account', type: 'bank', currency: 'CZK', openingBalance: '1250.5' }

const values: Record<string, unknown> = {
  JWT_ACCESS_SECRET: 'access-secret-with-at-least-32-chars',
  JWT_REFRESH_SECRET: 'refresh-secret-with-at-least-32-chars',
  JWT_ACCESS_TTL_SECONDS: 900,
  JWT_REFRESH_TTL_SECONDS: 2_592_000,
}

type Method = 'get' | 'post' | 'patch' | 'delete'

/**
 * Boots the controller behind the real guard, with a mocked `AccountsService`. Call it inside a `describe`: it
 * registers the `beforeEach` and `afterEach` for that block.
 */
export const useAccountsController = () => {
  const accounts = {
    list: vi.fn<AccountsService['list']>(),
    findOne: vi.fn<AccountsService['findOne']>(),
    create: vi.fn<AccountsService['create']>(),
    update: vi.fn<AccountsService['update']>(),
    remove: vi.fn<AccountsService['remove']>(),
  }
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
  const calls = (): number => Object.values(accounts).reduce((sum, mock) => sum + mock.mock.calls.length, 0)

  beforeEach(async () => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {
      // keeps the expected rejection warnings out of the test output
    })
    accounts.list.mockReset().mockResolvedValue([VIEW])
    accounts.findOne.mockReset().mockResolvedValue(VIEW)
    accounts.create.mockReset().mockResolvedValue(VIEW)
    accounts.update.mockReset().mockResolvedValue(VIEW)
    accounts.remove.mockReset().mockResolvedValue()

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [AccountsController],
      providers: [
        AuthTokensService,
        { provide: AccountsService, useValue: accounts },
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

  return { accounts, send, anonymous, calls }
}
