import 'reflect-metadata'

import { type DynamicModule, Global, Module, type Type } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'

import { PrismaService } from '../../../src/modules/prisma'
import * as transactionsDomain from '../../../src/modules/transactions'
import { TransactionsModule, TransactionTotalsService } from '../../../src/modules/transactions'
import { AccountsController } from '../../../src/modules/transactions/accounts/accounts.controller'
import { AccountsService } from '../../../src/modules/transactions/accounts/accounts.service'
import { CategoriesController } from '../../../src/modules/transactions/categories/categories.controller'
import { CategoriesService } from '../../../src/modules/transactions/categories/categories.service'
import { TransactionsController } from '../../../src/modules/transactions/transactions/transactions.controller'
import { TransactionsService } from '../../../src/modules/transactions/transactions/transactions.service'
import { TransfersController } from '../../../src/modules/transactions/transfers/transfers.controller'
import { TransfersService } from '../../../src/modules/transactions/transfers/transfers.service'

// `PrismaModule` is global in the app. No `ConfigService` here: the domain must boot without auth (it imports
// `OwnershipModule`, not `CoreModule`).
@Global()
@Module({ providers: [{ provide: PrismaService, useValue: {} }], exports: [PrismaService] })
class PrismaStubModule {}

/** The provider `ConsumerModule` makes of whatever it was asked to inject. */
const CONSUMED = Symbol('CONSUMED')

/**
 * What a module of another domain (the dashboard) looks like to `transactions`: it imports the domain module and
 * injects one of its providers.
 */
@Module({})
class ConsumerModule {
  static injecting(token: Type): DynamicModule {
    return {
      module: ConsumerModule,
      imports: [TransactionsModule],
      providers: [{ provide: CONSUMED, useFactory: (provider: unknown) => provider, inject: [token] }],
    }
  }
}

describe('TransactionsModule', () => {
  it('wires in the accounts, categories, transactions, transfers and totals features with nothing but Prisma from outside the domain', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [PrismaStubModule, TransactionsModule] }).compile()

    expect(moduleRef.get(AccountsService)).toBeInstanceOf(AccountsService)
    expect(moduleRef.get(AccountsController)).toBeInstanceOf(AccountsController)
    expect(moduleRef.get(CategoriesService)).toBeInstanceOf(CategoriesService)
    expect(moduleRef.get(CategoriesController)).toBeInstanceOf(CategoriesController)
    expect(moduleRef.get(TransactionsService)).toBeInstanceOf(TransactionsService)
    expect(moduleRef.get(TransactionsController)).toBeInstanceOf(TransactionsController)
    expect(moduleRef.get(TransfersService)).toBeInstanceOf(TransfersService)
    expect(moduleRef.get(TransfersController)).toBeInstanceOf(TransfersController)
    expect(moduleRef.get(TransactionTotalsService)).toBeInstanceOf(TransactionTotalsService)
  })

  it('lets a module of another domain inject the totals service by importing the domain module', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaStubModule, ConsumerModule.injecting(TransactionTotalsService)],
    }).compile()

    expect(moduleRef.get(CONSUMED)).toBeInstanceOf(TransactionTotalsService)
  })

  it('keeps every other service private to the domain: only the totals service is exported', async () => {
    await expect(
      Test.createTestingModule({
        imports: [PrismaStubModule, ConsumerModule.injecting(AccountsService)],
      }).compile(),
    ).rejects.toThrow(/AccountsService/u)
  })
})

describe('the barrel of the transactions domain', () => {
  it('exports the module and the totals service, and no type at run time', () => {
    expect(Object.keys(transactionsDomain).toSorted()).toStrictEqual(['TransactionTotalsService', 'TransactionsModule'])
  })
})
