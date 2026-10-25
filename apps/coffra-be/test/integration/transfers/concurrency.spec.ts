import { describe, expect, it } from 'vitest'

import { Prisma } from '../../../src/modules/prisma'
import { useIntegrationApp } from '../support/use-integration-app'

/** Repeats of each race: two requests at once do not always overlap, a few rounds make it likely. */
const ROUNDS = 5

// Two writes of one transfer at the same time. These are the only specs that send requests in parallel, two at a
// time: more would load the loopback (see `maxWorkers` in `vitest.config.mjs`).
describe('concurrent writes of one transfer', () => {
  const { as, world, prisma } = useIntegrationApp()

  const sidesOf = (pairId: string) =>
    prisma().transaction.findMany({ where: { transferPairId: pairId }, orderBy: { transferDirection: 'asc' } })

  it('ends two changes at once with both sides alike and no deadlock', async () => {
    const { a } = world()

    for (let round = 1; round <= ROUNDS; round += 1) {
      const amounts = [`${round}1.5`, `${round}2.5`]

      const responses = await Promise.all(
        amounts.map((amount) => as(a).patch(`/api/transfers/${a.transfer.pairId}`, { amount, note: `note ${amount}` })),
      )
      const sides = await sidesOf(a.transfer.pairId)

      expect(responses.map(({ status }) => status)).toStrictEqual([200, 200])
      expect(sides).toHaveLength(2)

      const [out, inSide] = sides as [(typeof sides)[number], (typeof sides)[number]]

      expect(out.amount.toFixed(4)).toBe(inSide.amount.toFixed(4))
      expect(out.note).toBe(inSide.note)
      expect(amounts.map((amount) => new Prisma.Decimal(amount).toFixed(4))).toContain(out.amount.toFixed(4))
    }
  })

  it('ends a change and a delete at once with no side left', async () => {
    const { a } = world()

    for (let round = 1; round <= ROUNDS; round += 1) {
      const created = await as(a)
        .post('/api/transfers', {
          fromAccountId: a.accounts.main,
          toAccountId: a.accounts.savings,
          amount: '10',
          date: '2026-02-01',
        })
        .expect(201)
      const { pairId } = created.body as { pairId: string }

      const [changed, deleted] = await Promise.all([
        as(a).patch(`/api/transfers/${pairId}`, { amount: '5' }),
        as(a).delete(`/api/transfers/${pairId}`),
      ])

      expect(deleted.status).toBe(204)
      expect([200, 404]).toContain(changed.status)
      expect(await sidesOf(pairId)).toStrictEqual([])
    }
  })
})
