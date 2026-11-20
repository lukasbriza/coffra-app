import 'reflect-metadata'

import type { DiscoveryService } from '@nestjs/core'
import { beforeEach, type Mock, vi } from 'vitest'

import { OwnershipService } from '../../../../../src/modules/core/ownership/ownership.service'
import type { Owner } from '../../../../../src/modules/core/ownership/ownership.types'
import { UserDeletionService } from '../../../../../src/modules/core/users/user-deletion.service'
import type { OwnerDataEraserInterface } from '../../../../../src/modules/core/users/users.types'
import { AuthSource, type Prisma, type PrismaService, type User } from '../../../../../src/modules/prisma'

// Shared by the use case specs of `UserDeletionService` (delete, confirmation, missing user, failure, erasers).

export const USER: User = {
  id: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11',
  email: 'dev@coffra.local',
  authSource: AuthSource.oidc,
  externalSubject: 'dde84b4e-03ed-4990-a23b-e1be2e5eaf1a',
  createdAt: new Date('2026-10-03T08:00:00Z'),
  updatedAt: new Date('2026-10-03T08:00:00Z'),
}

export const OWNER: Owner = { userId: USER.id }

/** What a discovered provider looks like to the service. */
type Discovered = { instance: unknown; name: string }

/** A fake eraser of a domain that writes down when it ran and with what. */
export type FakeEraser = OwnerDataEraserInterface & { eraseOwnerData: Mock<OwnerDataEraserInterface['eraseOwnerData']> }

/** What the service hands the callback of `$transaction`, and the options it passes. */
type TransactionCall = (
  callback: (client: Prisma.TransactionClient) => Promise<unknown>,
  options?: { timeout: number },
) => Promise<unknown>

/**
 * The service over a mocked Prisma, the real `OwnershipService` and a fake `DiscoveryService` that finds two erasers.
 * Call it inside a `describe`: it registers the `beforeEach` that resets the mocks and starts the service (its
 * `onModuleInit`) for that block.
 *
 * Every step writes its name into `log`, so a spec can pin the order: `transaction`, `findUnique`, `erase:<name>`,
 * `delete`.
 */
export const useUserDeletionService = () => {
  const log: string[] = []
  const tx = {
    user: {
      findUnique: vi.fn<(args: unknown) => Promise<User | null>>(),
      delete: vi.fn<(args: unknown) => Promise<User>>(),
    },
  }
  const transactionClient = tx as unknown as Prisma.TransactionClient
  const $transaction = vi.fn<TransactionCall>()
  const prisma = { $transaction, user: { findUnique: vi.fn(), delete: vi.fn() } }
  const getProviders = vi.fn<(options?: unknown) => Discovered[]>()
  const discovery = { getProviders } as unknown as DiscoveryService

  const erasers: Record<'transactions' | 'investments', FakeEraser> = {
    transactions: { eraseOwnerData: vi.fn() },
    investments: { eraseOwnerData: vi.fn() },
  }
  let service: UserDeletionService

  beforeEach(() => {
    log.length = 0

    for (const [name, eraser] of Object.entries(erasers)) {
      eraser.eraseOwnerData.mockReset().mockImplementation(() => {
        log.push(`erase:${name}`)
        return Promise.resolve()
      })
    }
    $transaction.mockReset().mockImplementation(async (callback) => {
      log.push('transaction')
      return callback(transactionClient)
    })
    tx.user.findUnique.mockReset().mockImplementation(() => {
      log.push('findUnique')
      return Promise.resolve(USER)
    })
    tx.user.delete.mockReset().mockImplementation(() => {
      log.push('delete')
      return Promise.resolve(USER)
    })
    prisma.user.findUnique.mockReset()
    prisma.user.delete.mockReset()
    getProviders.mockReset()
    getProviders.mockReturnValue([
      { instance: erasers.transactions, name: 'TransactionsDataEraser' },
      { instance: erasers.investments, name: 'InvestmentsDataEraser' },
    ])

    service = new UserDeletionService(prisma as unknown as PrismaService, new OwnershipService(), discovery)
    service.onModuleInit()
  })

  return {
    service: (): UserDeletionService => service,
    log,
    tx,
    transactionClient,
    prisma,
    $transaction,
    getProviders,
    erasers,
  }
}
