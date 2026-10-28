import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional } from 'class-validator'

import { DEFAULT_PERIOD, PERIODS } from '../constants'
import type { DashboardQuery, Period } from '../dashboard.types'

/**
 * Query of `GET /api/dashboard`: how far back the dashboard goes.
 *
 * `@IsOptional()` is enough in a query, unlike in a body: a query string has no `null`, every value is a string. An
 * empty value, a wrong spelling and a repeated parameter (it arrives as a list) are all refused by `@IsIn`.
 */
export class DashboardQueryDto implements DashboardQuery {
  /** The last 3 months, 6 months or a year, counted in calendar months; 3 months when left out. */
  @ApiPropertyOptional({
    enum: PERIODS,
    enumName: 'DashboardPeriod',
    default: DEFAULT_PERIOD,
    description:
      'How far back the dashboard goes, in whole calendar months including the current one: `3m` (three months), `6m` (six months) or `1y` (twelve months). The window starts on the first day of the oldest month and ends on the last day of the current month (UTC), so a transaction planned for later this month counts. Left out: `3m`.',
    example: '6m',
  })
  @IsOptional()
  @IsIn(PERIODS)
  period?: Period
}
