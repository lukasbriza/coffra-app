import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'

import { AuthTokensService } from '../../../../../src/modules/core/auth/auth-tokens.service'

import { configService, jwt } from './setup'

describe('AuthTokensService dependency injection', () => {
  it('resolves its dependencies through @Inject', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthTokensService,
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile()

    expect(moduleRef.get(AuthTokensService)).toBeInstanceOf(AuthTokensService)
  })
})
