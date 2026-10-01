import { Inject, Injectable, Logger } from '@nestjs/common'
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus'

import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class PrismaHealthIndicator {
  private readonly logger = new Logger(PrismaHealthIndicator.name)

  constructor(
    @Inject(HealthIndicatorService) private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  /** Reports only up/down. The error goes to the log, never into the response (may contain DB host/user). */
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
