import { PartialType } from '@nestjs/swagger'

import type { UpdateTransferInput } from '../transfers.types'

import { CreateTransferDto } from './create-transfer.dto'

/**
 * Body of `PATCH /api/transfers/:pairId`: any field of a create.
 *
 * `skipNullProperties: false` makes a field that is left out stay as it is, while `null` is validated like any other
 * value: refused for the NOT NULL columns, accepted for `note`, where it clears the note. The refusal of `categoryId`
 * and the check that both accounts differ come along from the create.
 */
export class UpdateTransferDto
  extends PartialType(CreateTransferDto, { skipNullProperties: false })
  implements UpdateTransferInput {}
