import { Test } from '@nestjs/testing'
import { describe, expect, it, vi } from 'vitest'

import { UserDeletionService } from '../../../../../src/modules/core/users/user-deletion.service'
import { UsersController } from '../../../../../src/modules/core/users/users.controller'
import { UsersService } from '../../../../../src/modules/core/users/users.service'

import { user } from './setup'

describe('UsersController dependency injection', () => {
  it('resolves the users service and the deletion through @Inject', async () => {
    const findById = vi.fn(() => Promise.resolve(user))
    const deleteUser = vi.fn(() => Promise.resolve())
    const moduleRef = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: { findById } },
        { provide: UserDeletionService, useValue: { delete: deleteUser } },
      ],
    }).compile()

    const controller = moduleRef.get(UsersController)

    // Both dependencies are in place: each route reaches its own service.
    await expect(controller.me(user.id)).resolves.toEqual({ id: user.id, email: user.email })
    await controller.deleteMe(user.id, { confirm: user.email })
    expect(deleteUser).toHaveBeenCalledExactlyOnceWith(user.id, { confirm: user.email })
  })
})
