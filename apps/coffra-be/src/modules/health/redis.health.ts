import { Inject, Injectable, Logger } from '@nestjs/common'
import { type HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus'

import { describeError } from '../../utils'
import { RedisService } from '../redis'

/**
 * Health check of Redis: it is up when it answers `PING`.
 *
 * Redis is a required service, like the database: the rate limit refuses requests with `503` while it does not answer,
 * so the probe says so too and the orchestrator sees it.
 */
@Injectable()
export class RedisHealthIndicator {
  private readonly logger = new Logger(RedisHealthIndicator.name)

  constructor(
    @Inject(HealthIndicatorService) private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  /**
   * Checks whether Redis answers.
   *
   * Reports only up or down. The log gets the class and the code of the error, never its message: it can carry the
   * address of Redis.
   *
   * @param key - name of the check in the result
   * @returns `up` when Redis answered, `down` otherwise
   */
  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key)

    try {
      await this.redis.ping()
      return indicator.up()
    } catch (error) {
      this.logger.error(`Redis check failed: ${describeError(error)}`)
      return indicator.down()
    }
  }
}
