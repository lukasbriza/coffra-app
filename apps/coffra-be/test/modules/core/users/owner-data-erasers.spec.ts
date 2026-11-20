import 'reflect-metadata'

import { DiscoveryService } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { describe, expect, it } from 'vitest'

import { AppModule } from '../../../../src/app.module'
import { OwnerDataEraser } from '../../../../src/modules/core'
import { PrismaService } from '../../../../src/modules/prisma'
import { RedisService } from '../../../../src/modules/redis'
import { TransactionsDataEraser } from '../../../../src/modules/transactions/erasure/transactions-data.eraser'
import { withoutRateLimit } from '../../rate-limit/rate-limit-overrides'
import { fakeRedis } from '../../redis/fake-redis'

/**
 * Every provider of the app that erases data of an owner when its user is deleted. A domain that starts to keep data of
 * an owner adds its eraser here on purpose, like a new public route in `public-routes.spec.ts`; without one, deleting a
 * user who has such data fails on its foreign key.
 */
const ERASERS = [TransactionsDataEraser]

// The real `AppModule`, compiled but not started: nothing connects, the discovery only lists the providers.
describe('the erasers of owner data in the app', () => {
  it('are exactly the listed ones, found through @OwnerDataEraser()', async () => {
    const moduleRef = await withoutRateLimit(
      Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(PrismaService)
        .useValue({})
        .overrideProvider(RedisService)
        .useValue(fakeRedis()),
    ).compile()

    const found = moduleRef
      .get(DiscoveryService, { strict: false })
      .getProviders({ metadataKey: OwnerDataEraser.KEY })
      .map(({ metatype }) => metatype)

    expect(found).toStrictEqual(ERASERS)
  })
})
