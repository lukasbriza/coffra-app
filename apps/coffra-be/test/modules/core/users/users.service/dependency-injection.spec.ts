import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'

import { UsersService } from '../../../../../src/modules/core/users/users.service'
import { PrismaService } from '../../../../../src/modules/prisma'

import { useUsersService } from './setup'

describe('UsersService dependency injection', () => {
  const { prisma } = useUsersService()

  it('resolves through Nest DI (@Inject(PrismaService) works without decorator metadata)', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    expect(moduleRef.get(UsersService)).toBeInstanceOf(UsersService)
  })
})
