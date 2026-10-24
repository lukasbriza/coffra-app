import { PartialType } from '@nestjs/swagger'

import type { UpdateTransactionInput } from '../transactions.types'

import { CreateTransactionDto } from './create-transaction.dto'

/**
 * Body of `PATCH /api/transactions/:id`: any field of a create.
 *
 * `skipNullProperties: false` makes a field that is left out stay as it is, while `null` is validated like any other
 * value: refused for the NOT NULL columns, accepted for `categoryId` and `note`, where it clears the value.
 */
export class UpdateTransactionDto
  extends PartialType(CreateTransactionDto, { skipNullProperties: false })
  implements UpdateTransactionInput {}
