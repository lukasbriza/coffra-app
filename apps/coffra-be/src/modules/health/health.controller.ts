import { Controller, Get, Inject } from '@nestjs/common'
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger'
import { HealthCheck, HealthCheckService } from '@nestjs/terminus'

import { Public } from '../core'

import { PrismaHealthIndicator } from './prisma.health'

const healthResultSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['ok', 'error'] },
    info: { type: 'object', additionalProperties: { type: 'object' } },
    error: { type: 'object', additionalProperties: { type: 'object' } },
    details: { type: 'object', additionalProperties: { type: 'object' } },
  },
}

@Public()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    @Inject(HealthCheckService) private readonly health: HealthCheckService,
    @Inject(PrismaHealthIndicator) private readonly prismaHealth: PrismaHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOkResponse({ description: 'All checks passed', schema: healthResultSchema })
  @ApiServiceUnavailableResponse({ description: 'At least one check failed', schema: healthResultSchema })
  check() {
    return this.health.check([() => this.prismaHealth.isHealthy('database')])
  }
}
