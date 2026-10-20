import { describe, expectTypeOf, it } from 'vitest'

import type { OwnerData, OwnerScope } from '../../../src/modules/core'
import type { Account, Category, Prisma, Transaction } from '../../../src/modules/prisma/generated/client'
import type { EditableScope } from '../../../src/modules/transactions/transactions/transactions.types'

// A compile-time contract, checked by `pnpm ts` (the runtime assertions are no-ops): the scope and the owner data of
// the ownership layer fit the queries `transactions` writes on its own models. When the layer switches to workspaces
// (`{ tenantId }`), this file shows whether the models can carry it.

/** `{ id, ...ownership.scope(owner) }` */
type ScopedById = { id: string } & OwnerScope

describe('the owner scope on the transactions models', () => {
  it('narrows a root model next to its id, for reads and for writes', () => {
    expectTypeOf<ScopedById>().toExtend<Prisma.AccountWhereInput>()
    expectTypeOf<ScopedById>().toExtend<Prisma.AccountWhereUniqueInput>()
    expectTypeOf<ScopedById>().toExtend<Prisma.CategoryWhereInput>()
    expectTypeOf<ScopedById>().toExtend<Prisma.CategoryWhereUniqueInput>()
  })

  it('narrows a transaction through its account', () => {
    expectTypeOf<{ account: OwnerScope }>().toExtend<Prisma.TransactionWhereInput>()
    expectTypeOf<{ id: string; account: OwnerScope }>().toExtend<Prisma.TransactionWhereUniqueInput>()
  })

  it('narrows a write on a transaction to income and expense next to the scope', () => {
    expectTypeOf<{ id: string } & EditableScope>().toExtend<Prisma.TransactionWhereUniqueInput>()
  })

  it('fills the owner columns of a new account and a new category', () => {
    expectTypeOf<
      { name: string; type: 'cash'; currency: string } & OwnerData
    >().toExtend<Prisma.AccountUncheckedCreateInput>()
    expectTypeOf<{ name: string } & OwnerData>().toExtend<Prisma.CategoryUncheckedCreateInput>()
  })

  it('has a nullable tenantId on the root models only', () => {
    expectTypeOf<Account['tenantId']>().toEqualTypeOf<string | null>()
    expectTypeOf<Category['tenantId']>().toEqualTypeOf<string | null>()
    expectTypeOf<Transaction>().not.toHaveProperty('tenantId')
  })
})
