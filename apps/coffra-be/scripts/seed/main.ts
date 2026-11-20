import 'dotenv/config'

import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../../src/modules/prisma/generated/client'
import { describeError, formatIsoDate } from '../../src/utils'

import { assertSeedAllowed } from './assert-seed-allowed'
import { seedDemo } from './seed-demo'
import { describeSummary } from './utils/describe-summary'

// `pnpm db:seed`: the command line around `seedDemo`. It reads the environment once, refuses production before it
// connects to anything, and takes today from the clock, in UTC like every date in the API. It does not validate the
// environment of the app (`ConfigModule`): that wants an identity provider and three secrets the seed has no use for.

/** Seeds the database named by `DATABASE_URL` and prints what happened. */
const main = async (): Promise<void> => {
  const connectionString = assertSeedAllowed(process.env)
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

  try {
    const summary = await seedDemo(client, formatIsoDate(new Date()))

    process.stdout.write(`${describeSummary(summary)}\n`)
  } finally {
    await client.$disconnect()
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : describeError(error)}\n`)
  process.exitCode = 1
})
