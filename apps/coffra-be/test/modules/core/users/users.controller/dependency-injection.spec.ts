import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'

import { UsersController } from '../../../../../src/modules/core/users/users.controller'
import { UsersService } from '../../../../../src/modules/core/users/users.service'

describe('UsersController dependency injection', () => {
  it('resolves its dependencies through @Inject', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: { findById: () => null } }],
    }).compile()

    expect(moduleRef.get(UsersController)).toBeInstanceOf(UsersController)
  })
})
