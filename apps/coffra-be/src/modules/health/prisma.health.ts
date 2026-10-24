import { Inject, Injectable, Logger } from '@nestjs/common'
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus'

import { PrismaService } from '../prisma'

/** Health check of the database: it is up when `SELECT 1` succeeds. */
@Injectable()
export class PrismaHealthIndicator {
  private readonly logger = new Logger(PrismaHealthIndicator.name)

  constructor(
    @Inject(HealthIndicatorService) private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /**
   * Checks whether the database answers.
   *
   * Reports only up or down. The error goes to the log, never into the response, because it may contain the database
   * host or user.
   *
   * @param key - name of the check in the result
   * @returns `up` when the query succeeded, `down` otherwise
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key)

    try {
      await this.prisma.$queryRaw`SELECT 1`
      return indicator.up()
    } catch (error) {
      this.logger.error(`Database check failed: ${error instanceof Error ? error.message : String(error)}`)
      return indicator.down()
    }
  }
}
