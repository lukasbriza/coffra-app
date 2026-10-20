import { PartialType } from '@nestjs/swagger'

import type { UpdateTransactionInput } from '../transactions.types'

import { CreateTransactionDto } from './create-transaction.dto'

// `skipNullProperties: false`: a field left out is not changed, but `null` is validated like any other value: refused
// for the NOT NULL columns, accepted for `categoryId` and `note`, where it clears the value.
export class UpdateTransactionDto
  extends PartialType(CreateTransactionDto, { skipNullProperties: false })
  implements UpdateTransactionInput {}
