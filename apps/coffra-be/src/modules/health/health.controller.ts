import { Controller, Get, Inject } from '@nestjs/common'
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger'
import { HealthCheck, HealthCheckService } from '@nestjs/terminus'

import { Public } from '../core'

import { PrismaHealthIndicator } from './prisma.health'

/** Swagger schema of the result of a health check, for both the `200` and the `503` answer. */
const healthResultSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ok', 'error'] },
    info: { type: 'object', additionalProperties: { type: 'object' } },
    error: { type: 'object', additionalProperties: { type: 'object' } },
    details: { type: 'object', additionalProperties: { type: 'object' } },
  },
}

/**
 * Probe for the container orchestrator: `GET /api/health`.
 *
 * Public, so it needs no token. The whole controller is public on purpose; a check added here is public too.
 */
@Public()
@Controller('health')
// Swagger
@ApiTags('health')
export class HealthController {
  constructor(
    @Inject(HealthCheckService) private readonly health: HealthCheckService,
    @Inject(PrismaHealthIndicator) private readonly prismaHealth: PrismaHealthIndicator,
  ) {}

  /**
   * Runs the checks: the database answers a query.
   *
   * @returns the result of the checks, `200` when all passed
   * @throws ServiceUnavailableException when at least one check failed (`503` with the same shape)
   */
  @Get()
  @HealthCheck()
  // Swagger
  @ApiOkResponse({ description: 'All checks passed', schema: healthResultSchema })
  @ApiServiceUnavailableResponse({ description: 'At least one check failed', schema: healthResultSchema })
  check() {
    return this.health.check([() => this.prismaHealth.isHealthy('database')])
  }
}
