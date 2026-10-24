import { ApiProperty } from '@nestjs/swagger'

import { AccountType } from '../../../prisma'
import type { AccountView } from '../accounts.types'

/** Swagger shape of `AccountView`: the same fields, described for the schema of the API. */
export class AccountDto implements AccountView {
  @ApiProperty({ format: 'uuid' })
  id!: string

  @ApiProperty({ example: 'Main account' })
  name!: string

  @ApiProperty({ enum: AccountType, enumName: 'AccountType' })
  type!: AccountType

  @ApiProperty({ description: 'Three capital letters, fixed since the account was created', example: 'CZK' })
  currency!: string

  @ApiProperty({ description: 'Decimal string with four decimal places', example: '-1500.2500' })
  openingBalance!: string

  @ApiProperty({
    description:
      'Decimal string with four decimal places, in the currency of the account: the opening balance plus income and incoming transfers, minus expenses and outgoing transfers, of the transactions dated up to `asOf` (today in UTC by default). May be negative.',
    example: '4500.5500',
  })
  balance!: string
}
