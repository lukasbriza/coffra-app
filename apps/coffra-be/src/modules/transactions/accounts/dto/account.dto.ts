import { ApiProperty } from '@nestjs/swagger'

import { AccountType } from '../../../prisma'
import type { AccountView } from '../accounts.types'

/** Swagger shape of `AccountView`. */
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
}
