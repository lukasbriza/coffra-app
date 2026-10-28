import { ApiProperty } from '@nestjs/swagger'

import type { MonthView } from '../dashboard.types'

/** Swagger shape of `MonthView`: the same fields, described for the schema of the API. */
export class MonthTotalsDto implements MonthView {
  @ApiProperty({
    description: 'The calendar month in UTC, `YYYY-MM`',
    pattern: String.raw`^\d{4}-\d{2}$`,
    example: '2026-08',
  })
  month!: string

  @ApiProperty({
    description: 'Sum of the income of the month, a decimal string with four decimal places',
    example: '26000.0000',
  })
  income!: string

  @ApiProperty({
    description: 'Sum of the expense of the month, a decimal string with four decimal places',
    example: '9800.0000',
  })
  expense!: string

  @ApiProperty({
    description: '`income` minus `expense`, a decimal string with four decimal places; negative when more was spent',
    example: '16200.0000',
  })
  net!: string
}
