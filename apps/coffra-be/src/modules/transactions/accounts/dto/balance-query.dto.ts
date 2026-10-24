import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional } from 'class-validator'

import { IsIsoDate } from '../../common/decorators/is-iso-date.decorator'
import type { BalanceQuery } from '../accounts.types'

/**
 * Query of `GET /api/accounts` and `GET /api/accounts/:id`: the day the balances are counted to.
 *
 * `@IsOptional()` is enough in a query, unlike in a body: a query string has no `null`, every value is a string.
 */
export class BalanceQueryDto implements BalanceQuery {
  /** Calendar day `YYYY-MM-DD`, inclusive; today (UTC) when left out. */
  @ApiPropertyOptional({
    format: 'date',
    description:
      'Count the transactions up to this day, inclusive. Left out: today in UTC, so a transaction dated later does not count yet. A later day adds the planned ones. A client west or east of UTC sends its own date to count its today.',
    example: '2026-10-22',
  })
  @IsOptional()
  @IsIsoDate()
  asOf?: string
}
