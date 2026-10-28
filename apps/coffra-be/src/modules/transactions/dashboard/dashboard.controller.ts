import { Controller, Get, Inject, Query } from '@nestjs/common'
import { ApiBadRequestResponse, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger'

import { CurrentOwner, type Owner } from '../../core'

import { DashboardService } from './dashboard.service'
import type { DashboardView } from './dashboard.types'
import { DashboardQueryDto } from './dto/dashboard-query.dto'
import { DashboardDto } from './dto/dashboard.dto'

/**
 * HTTP layer of the dashboard under `/api/dashboard`.
 *
 * Takes the owner from the access token and the validated query from the request, hands both to
 * {@link DashboardService} and returns its answer. It has no logic of its own.
 */
@Controller('dashboard')
// Swagger
@ApiTags('dashboard')
@ApiUnauthorizedResponse({ description: 'The access token is missing, invalid or expired' })
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboard: DashboardService) {}

  /**
   * `GET /api/dashboard`: the income and the expense of the signed-in user over the last months.
   *
   * @param owner - whose transactions to add up, from the access token
   * @param query - the period (`3m`, `6m` or `1y`); `3m` when left out
   * @returns the totals per currency with their categories
   */
  @Get()
  // Swagger
  @ApiOperation({
    summary:
      'Income and expense of the signed-in user over the last 3 months, 6 months or a year, per currency and per category',
  })
  @ApiOkResponse({
    description: 'The totals, one entry per currency that has a transaction in the window',
    type: DashboardDto,
  })
  @ApiBadRequestResponse({ description: '`period` is not `3m`, `6m` or `1y`, or is given more than once' })
  get(@CurrentOwner() owner: Owner, @Query() query: DashboardQueryDto): Promise<DashboardView> {
    return this.dashboard.get(owner, query)
  }
}
