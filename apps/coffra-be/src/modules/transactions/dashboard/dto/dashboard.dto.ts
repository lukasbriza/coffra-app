import { ApiProperty } from '@nestjs/swagger'

import { PERIODS } from '../constants'
import type { CategoryView, CurrencyView, DashboardView, Period } from '../dashboard.types'

import { MonthTotalsDto } from './month-totals.dto'

/** Swagger shape of `CategoryView`: the same fields, described for the schema of the API. */
export class CategoryTotalsDto implements CategoryView {
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Id of the category; `null` on the row that sums the transactions that have no category',
  })
  categoryId!: string | null

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Name of the category; `null` together with `categoryId`',
    example: 'Food',
  })
  name!: string | null

  @ApiProperty({ description: 'Sum of the income, a decimal string with four decimal places', example: '0.0000' })
  income!: string

  @ApiProperty({ description: 'Sum of the expense, a decimal string with four decimal places', example: '12000.0000' })
  expense!: string

  @ApiProperty({
    description: '`income` minus `expense`, a decimal string with four decimal places; negative when more was spent',
    example: '-12000.0000',
  })
  net!: string
}

/** Swagger shape of `CurrencyView`: the same fields, described for the schema of the API. */
export class CurrencyTotalsDto implements CurrencyView {
  @ApiProperty({ description: 'Three capital letters. Amounts of two currencies are never added.', example: 'CZK' })
  currency!: string

  @ApiProperty({
    description: 'Sum of the income of every category, a decimal string with four decimal places',
    example: '52000.0000',
  })
  income!: string

  @ApiProperty({
    description: 'Sum of the expense of every category, a decimal string with four decimal places',
    example: '31250.5000',
  })
  expense!: string

  @ApiProperty({
    description: '`income` minus `expense`, a decimal string with four decimal places; negative when more was spent',
    example: '20749.5000',
  })
  net!: string

  @ApiProperty({
    type: [CategoryTotalsDto],
    description:
      'The categories the totals are made of, the one with the largest `income + expense` first. The transactions without a category are the last row.',
  })
  categories!: CategoryTotalsDto[]

  @ApiProperty({
    type: [MonthTotalsDto],
    description:
      'The totals month by month, the oldest first: one entry for every calendar month of the window (3, 6 or 12), so a month without a transaction is there with zeros. The months add up to the totals of the currency.',
  })
  trend!: MonthTotalsDto[]
}

/** Swagger shape of `DashboardView`: the same fields, described for the schema of the API. */
export class DashboardDto implements DashboardView {
  @ApiProperty({ enum: PERIODS, enumName: 'DashboardPeriod', description: 'The period that was used', example: '3m' })
  period!: Period

  @ApiProperty({
    format: 'date',
    description: 'First day of the window: the first day of the oldest month',
    example: '2026-08-01',
  })
  from!: string

  @ApiProperty({
    format: 'date',
    description: 'Last day of the window: the last day of the current month',
    example: '2026-10-31',
  })
  to!: string

  @ApiProperty({
    type: [CurrencyTotalsDto],
    description:
      'One entry per currency that has at least one transaction in the window, in alphabetical order. Transfers and the opening balance of an account are not counted; planned transactions dated inside the window are. Empty when nothing falls in the window.',
  })
  currencies!: CurrencyTotalsDto[]
}
