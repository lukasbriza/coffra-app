import 'reflect-metadata'

import { Global, Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'

import { PrismaService } from '../../../src/modules/prisma'
import { TransactionsModule } from '../../../src/modules/transactions'
import { AccountsController } from '../../../src/modules/transactions/accounts/accounts.controller'
import { AccountsService } from '../../../src/modules/transactions/accounts/accounts.service'
import { CategoriesController } from '../../../src/modules/transactions/categories/categories.controller'
import { CategoriesService } from '../../../src/modules/transactions/categories/categories.service'

// `PrismaModule` is global in the app. No `ConfigService` here: the domain must boot without auth (it imports
// `OwnershipModule`, not `CoreModule`).
@Global()
@Module({ providers: [{ provide: PrismaService, useValue: {} }], exports: [PrismaService] })
class PrismaStubModule {}

describe('TransactionsModule', () => {
  it('wires in the accounts and categories features with nothing but Prisma from outside the domain', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [PrismaStubModule, TransactionsModule] }).compile()

    expect(moduleRef.get(AccountsService)).toBeInstanceOf(AccountsService)
    expect(moduleRef.get(AccountsController)).toBeInstanceOf(AccountsController)
    expect(moduleRef.get(CategoriesService)).toBeInstanceOf(CategoriesService)
    expect(moduleRef.get(CategoriesController)).toBeInstanceOf(CategoriesController)
  })
})
