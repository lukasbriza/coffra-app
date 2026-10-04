import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'

import { AUTH_PROVIDER } from '../../../../../src/modules/core'
import { AuthChecksService } from '../../../../../src/modules/core/auth/auth-checks.service'
import { AuthTokensService } from '../../../../../src/modules/core/auth/auth-tokens.service'
import { AuthService } from '../../../../../src/modules/core/auth/auth.service'
import { UsersService } from '../../../../../src/modules/core/users/users.service'

import { useAuthService } from './setup'

describe('AuthService dependency injection', () => {
  const { provider, checksService, tokensService, upsertByExternalSubject, findById } = useAuthService()

  it('resolves its dependencies through @Inject', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AUTH_PROVIDER, useValue: provider },
        { provide: AuthChecksService, useValue: checksService },
        { provide: AuthTokensService, useValue: tokensService },
        { provide: UsersService, useValue: { upsertByExternalSubject, findById } },
      ],
    }).compile()

    expect(moduleRef.get(AuthService)).toBeInstanceOf(AuthService)
  })
})
