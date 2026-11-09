import { describe, expect, it } from 'vitest'

import { seedDemo } from '../../../scripts/seed/seed-demo'
import type { SeedClient } from '../../../scripts/seed/types'
import type { Prisma, PrismaService } from '../../../src/modules/prisma'
import { useIntegrationApp } from '../support/use-integration-app'

import { seedAt } from './setup'

const CLOCK = '2026-10-30T12:00:00.000Z'

type Model = 'account' | 'category' | 'transaction'

/**
 * The model of a transaction whose `createMany` fails and nothing else does.
 *
 * @param delegate - the delegate of the model (`tx.account`)
 * @param model - its name, for the message
 * @returns the same delegate with a failing `createMany`
 */
const failingDelegate = (delegate: object, model: Model): object =>
  new Proxy(delegate, {
    get: (target, method): unknown =>
      method === 'createMany'
        ? () => Promise.reject(new Error(`the ${model} insert failed`))
        : (Reflect.get(target, method) as unknown),
  })

/**
 * A client whose transaction works as usual except that writing the rows of one model fails: what comes before it in the
 * seed (the delete of the old data, the other inserts) has been done by then.
 *
 * @param prisma - the real client
 * @param model - whose `createMany` fails
 * @returns the client for `seedDemo`
 */
const failingOn = (prisma: PrismaService, model: Model): SeedClient => ({
  $transaction: ((callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
    prisma.$transaction((tx) =>
      callback(
        new Proxy(tx, {
          get: (target, property): unknown =>
            property === model ? failingDelegate(target[model], model) : (Reflect.get(target, property) as unknown),
        }),
      ),
    )) as unknown as SeedClient['$transaction'],
})

// The seed deletes the old data and writes the new one. A failure at any step must leave the old data: with the
// transaction taken out, the delete would stay and the demo user would be left without data.
describe('a seed that fails half way', () => {
  const app = useIntegrationApp()
  const { prisma, snapshot, unchanged } = app

  it.each<Model>(['account', 'category', 'transaction'])(
    'leaves the database as it was when the %s insert fails',
    async (model) => {
      await seedAt(app, CLOCK)

      await unchanged(async () => {
        await expect(seedDemo(failingOn(prisma(), model), '2026-08-15')).rejects.toThrow(`the ${model} insert failed`)
      })
    },
  )

  it('does the same work when nothing fails, so the failures above are the only difference', async () => {
    const { summary } = await seedAt(app, CLOCK)
    const before = await snapshot()

    const again = await seedDemo(prisma(), '2026-08-15')

    expect(again.userId).toBe(summary.userId)
    expect(await snapshot()).not.toStrictEqual(before)
  })
})
