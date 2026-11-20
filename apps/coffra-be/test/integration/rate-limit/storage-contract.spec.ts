import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'

import { type ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { RedisThrottlerStorage } from '../../../src/modules/rate-limit/redis-throttler-storage'
import { openRedis } from '../support/redis'

// What a storage of the rate limit has to do, asked of the in-memory store of `@nestjs/throttler` and of the Redis one
// alike. The library's store is the reference: whatever the app did before Redis is what Redis has to keep doing. Real
// time, short windows: Redis keeps the clock, so a stopped `Date` would say nothing about it. Every test has a client of
// its own (a new key), so nothing is shared between them.

type Subject = { storage: ThrottlerStorage; close: () => Promise<void> }

type CountOptions = { ttl?: number; limit?: number; block?: number }

const implementations: [string, () => Subject][] = [
  [
    'the in-memory store of @nestjs/throttler',
    () => {
      const storage = new ThrottlerStorageService()

      return {
        storage,
        close: () => {
          storage.onApplicationShutdown()

          return Promise.resolve()
        },
      }
    },
  ],
  [
    'the Redis storage',
    () => {
      const redis = openRedis()

      return {
        storage: new RedisThrottlerStorage(redis),
        close: async () => {
          await redis.quit()
        },
      }
    },
  ],
]

/** A client nobody has counted before. */
const newClient = (): string => `client-${randomUUID()}`

describe.each(implementations)('%s', (_name, create) => {
  let subject: Subject

  beforeAll(() => {
    subject = create()
  })

  afterAll(async () => {
    await subject.close()
  })

  /**
   * Counts one hit of `client`, times in milliseconds.
   *
   * @param client - the key
   * @param options - `ttl` (the window, 1000 when left out), `limit` (3) and `block` (the window when left out)
   * @returns what the storage answered
   */
  const count = (client: string, { ttl = 1000, limit = 3, block = ttl }: CountOptions = {}) =>
    subject.storage.increment(client, ttl, limit, block, 'default')

  /** Counts one hit with no block: a window of 600 ms and a limit of 2. */
  const countWithoutBlock = (client: string) => count(client, { ttl: 600, limit: 2, block: 0 })

  describe('with a block (the way the app uses it)', () => {
    it('counts the hits up to the limit, and blocks the one that goes over', async () => {
      const client = newClient()

      const records = [await count(client), await count(client), await count(client), await count(client)]

      expect(records.map((record) => [record.totalHits, record.isBlocked])).toStrictEqual([
        [1, false],
        [2, false],
        [3, false],
        [4, true],
      ])
      expect(records[3]?.timeToBlockExpire).toBe(1)
      expect(records[0]?.timeToBlockExpire).toBeLessThanOrEqual(0)
    })

    it('keeps a client apart from every other client', async () => {
      const one = newClient()
      const another = newClient()

      for (let hit = 0; hit < 4; hit += 1) {
        await count(one)
      }

      expect(await count(one)).toMatchObject({ isBlocked: true })
      expect(await count(another)).toMatchObject({ totalHits: 1, isBlocked: false })
    })

    it('counts a throttler of another name on its own', async () => {
      const client = newClient()

      await subject.storage.increment(client, 1000, 3, 1000, 'first')
      await subject.storage.increment(client, 1000, 3, 1000, 'first')

      expect(await subject.storage.increment(client, 1000, 3, 1000, 'second')).toMatchObject({ totalHits: 1 })
    })

    it('does not count a blocked client, and lets it in with a fresh count when the block ends', async () => {
      const client = newClient()

      for (let hit = 0; hit < 4; hit += 1) {
        await count(client, { ttl: 600 })
      }
      const stillBlocked = await count(client, { ttl: 600 })
      await sleep(700)
      const afterBlock = await count(client, { ttl: 600 })

      expect(stillBlocked).toMatchObject({ totalHits: 4, isBlocked: true })
      expect(afterBlock).toMatchObject({ totalHits: 1, isBlocked: false })
    })

    it('lets the hits leave the window one by one, each ttl after it was made', async () => {
      const client = newClient()

      await count(client)
      await sleep(600)
      await count(client)
      await sleep(600)

      // The first hit is 1.2 s old and gone, the second is 0.6 s old and still counts.
      expect(await count(client)).toMatchObject({ totalHits: 2, isBlocked: false })
    })

    it('keeps a client blocked for the block, also when the block is longer than the window', async () => {
      const client = newClient()
      const longBlock = { ttl: 300, limit: 1, block: 1500 }

      await count(client, longBlock)
      expect(await count(client, longBlock)).toMatchObject({ isBlocked: true })

      await sleep(500)
      // The hits are long gone, the block is not over.
      expect(await count(client, longBlock)).toMatchObject({ isBlocked: true })

      await sleep(1100)
      expect(await count(client, longBlock)).toMatchObject({ totalHits: 1, isBlocked: false })
    })

    it('forgets the hits when the block ends, also when the block is shorter than the window', async () => {
      const client = newClient()
      const shortBlock = { ttl: 1500, limit: 2, block: 400 }

      await count(client, shortBlock)
      await count(client, shortBlock)
      expect(await count(client, shortBlock)).toMatchObject({ isBlocked: true })

      await sleep(500)

      // The three hits are still inside the window of 1.5 s, but the block ended and took them with it.
      expect(await count(client, shortBlock)).toMatchObject({ totalHits: 1, isBlocked: false })
    })

    it('gives the times in whole seconds, rounded up', async () => {
      const client = newClient()

      const record = await count(client, { ttl: 5000 })

      expect(record.timeToExpire).toBeGreaterThanOrEqual(4)
      expect(record.timeToExpire).toBeLessThanOrEqual(5)
    })
  })

  describe('without a block (a block of zero)', () => {
    it('refuses what goes over the limit, and does not count what it refused', async () => {
      const client = newClient()

      await countWithoutBlock(client)
      await countWithoutBlock(client)
      const refused = await countWithoutBlock(client)
      await countWithoutBlock(client)
      await sleep(700)

      expect(refused).toMatchObject({ totalHits: 3, isBlocked: true })
      expect(refused.timeToBlockExpire).toBeGreaterThanOrEqual(1)
      // The two counted hits are gone; the two refused ones were never counted, so the client starts from one.
      expect(await countWithoutBlock(client)).toMatchObject({ totalHits: 1, isBlocked: false })
    })
  })
})
