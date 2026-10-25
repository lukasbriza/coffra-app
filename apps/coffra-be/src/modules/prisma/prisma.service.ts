import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'

import type { Env } from '../config'

import { PrismaClient } from './generated/client'

/**
 * The Prisma client of the application, connected to Postgres through the `pg` driver adapter.
 *
 * The connection string comes from the configuration (`DATABASE_URL`), not from the Prisma schema. The connection is
 * opened when the module starts and closed when the application shuts down.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    super({ adapter: new PrismaPg({ connectionString: config.get('DATABASE_URL', { infer: true }) }) })
  }

  /** Opens the connection to the database. */
  async onModuleInit(): Promise<void> {
    await this.$connect()
  }

  /** Closes the connection to the database. */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
