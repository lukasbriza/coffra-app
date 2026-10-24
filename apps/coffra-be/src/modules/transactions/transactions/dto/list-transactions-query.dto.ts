import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator'

import { TransactionType } from '../../../prisma'
import { IsIsoDate } from '../../common/decorators/is-iso-date.decorator'
import { IsNotBefore } from '../../common/decorators/is-not-before.decorator'
import { IsQueryInteger } from '../../common/decorators/is-query-integer.decorator'
import { DEFAULT_LIST_LIMIT, LIST_ORDERS, MAX_LIST_LIMIT } from '../constants'
import { IsListCursor } from '../decorators/is-list-cursor.decorator'
import type { ListCursor, ListOrder, ListTransactionsInput } from '../transactions.types'

/**
 * Query of `GET /api/transactions`: the filters, the order and the position of the page.
 *
 * `@IsOptional()` is enough in a query, unlike in a body: a query string has no `null`, every value is a string.
 */
export class ListTransactionsQueryDto implements ListTransactionsInput {
  @ApiPropertyOptional({ format: 'uuid', description: 'Only the transactions of this account' })
  @IsOptional()
  @IsUUID()
  accountId?: string

  @ApiPropertyOptional({ format: 'uuid', description: 'Only the transactions of this category; a transfer has none' })
  @IsOptional()
  @IsUUID()
  categoryId?: string

  /**
   * Only the transactions of this type.
   *
   * All three types, unlike a create: the list shows both sides of a transfer.
   */
  @ApiPropertyOptional({ enum: TransactionType, enumName: 'TransactionType' })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType

  @ApiPropertyOptional({ format: 'date', description: 'First day, inclusive', example: '2026-10-01' })
  @IsOptional()
  @IsIsoDate()
  from?: string

  @ApiPropertyOptional({ format: 'date', description: 'Last day, inclusive; not before `from`', example: '2026-10-31' })
  @IsOptional()
  @IsIsoDate()
  @IsNotBefore('from')
  to?: string

  @ApiPropertyOptional({
    enum: [...LIST_ORDERS],
    enumName: 'ListOrder',
    default: 'desc',
    description: 'By date, then by the time of recording: `desc` the newest first, `asc` the oldest first',
  })
  @IsIn(LIST_ORDERS)
  order: ListOrder = 'desc'

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: MAX_LIST_LIMIT,
    default: DEFAULT_LIST_LIMIT,
    description: 'Most transactions on the page',
  })
  @IsQueryInteger(1, MAX_LIST_LIMIT)
  limit: number = DEFAULT_LIST_LIMIT

  @ApiPropertyOptional({
    type: String,
    description:
      'The `nextCursor` of the previous page, as it came, with the same `order` and filters; left out for the first page',
  })
  @IsOptional()
  @IsListCursor()
  cursor?: ListCursor
}
