import { PartialType } from '@nestjs/swagger'

import type { UpdateTransferInput } from '../transfers.types'

import { CreateTransferDto } from './create-transfer.dto'

// `skipNullProperties: false`: a field left out is not changed, but `null` is validated like any other value: refused
// for the NOT NULL columns, accepted for `note`, where it clears the note. The refusal of `categoryId` and the check
// that both accounts differ come along from the create.
export class UpdateTransferDto
  extends PartialType(CreateTransferDto, { skipNullProperties: false })
  implements UpdateTransferInput {}
