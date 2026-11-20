import 'reflect-metadata'

import { Global, Injectable, Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { describe, expect, it, vi } from 'vitest'

import type { Owner } from '../../../../../src/modules/core/ownership/ownership.types'
import { OwnerDataEraser } from '../../../../../src/modules/core/users/decorators/owner-data-eraser.decorator'
import { UserDeletionService } from '../../../../../src/modules/core/users/user-deletion.service'
import { UsersModule } from '../../../../../src/modules/core/users/users.module'
import { type Prisma, PrismaService } from '../../../../../src/modules/prisma'

import { OWNER, USER, useUserDeletionService } from './setup'

/** Every call any eraser of this file got, in order. */
const calls: string[] = []

/** The client the transaction of this file hands out. */
const transactionClient = {
  user: { findUnique: vi.fn(() => Promise.resolve(USER)), delete: vi.fn(() => Promise.resolve(USER)) },
} as unknown as Prisma.TransactionClient

// `PrismaModule` is global in the app; here its transaction only hands out the client above.
@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      useValue: {
        $transaction: (callback: (client: Prisma.TransactionClient) => Promise<unknown>) => callback(transactionClient),
      },
    },
  ],
  exports: [PrismaService],
})
class PrismaStubModule {}

/** An eraser of a domain, marked as the port asks. */
@Injectable()
@OwnerDataEraser()
class MarkedEraser {
  eraseOwnerData(owner: Owner, tx: Prisma.TransactionClient): Promise<void> {
    calls.push(`marked:${owner.userId}:${tx === transactionClient}`)
    return Promise.resolve()
  }
}

/** The same method without the decorator: never called, the port is the decorator, not the shape. */
@Injectable()
class UnmarkedEraser {
  eraseOwnerData(): Promise<void> {
    calls.push('unmarked')
    return Promise.resolve()
  }
}

describe('UserDeletionService: the erasers of the domains', () => {
  const { service, log, getProviders, tx, erasers } = useUserDeletionService()

  it('asks the discovery for the providers marked @OwnerDataEraser()', () => {
    expect(getProviders).toHaveBeenCalledExactlyOnceWith({ metadataKey: OwnerDataEraser.KEY })
  })

  it('refuses to start when a marked provider does not implement the port, and names it', () => {
    getProviders.mockReturnValue([{ instance: { erase: () => Promise.resolve() }, name: 'BrokenEraser' }])

    expect(() => {
      service().onModuleInit()
    }).toThrow('BrokenEraser is marked @OwnerDataEraser() but does not implement eraseOwnerData')
  })

  it.each([
    ['no instance', undefined],
    ['null', null],
    ['a method that is not a function', { eraseOwnerData: 'yes' }],
  ])('refuses to start for a marked provider with %s', (_name, instance) => {
    getProviders.mockReturnValue([{ instance, name: 'BrokenEraser' }])

    expect(() => {
      service().onModuleInit()
    }).toThrow(/BrokenEraser/u)
  })

  it('deletes only the user when no domain has an eraser', async () => {
    getProviders.mockReturnValue([])
    service().onModuleInit()

    await service().delete(USER.id, { confirm: USER.email })

    expect(log).toStrictEqual(['transaction', 'findUnique', 'delete'])
    expect(tx.user.delete).toHaveBeenCalledOnce()
    expect(erasers.transactions.eraseOwnerData).not.toHaveBeenCalled()
  })

  it('finds a marked provider of any module of the app through the real discovery, and only a marked one', async () => {
    calls.length = 0
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaStubModule, UsersModule],
      providers: [MarkedEraser, UnmarkedEraser],
    }).compile()
    await moduleRef.init()

    await moduleRef.get(UserDeletionService).delete(USER.id, { confirm: USER.email })

    expect(calls).toStrictEqual([`marked:${OWNER.userId}:true`])
    await moduleRef.close()
  })
})
