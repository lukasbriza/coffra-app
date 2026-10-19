import { PartialType } from '@nestjs/swagger'

import type { UpdateCategoryInput } from '../categories.types'

import { CreateCategoryDto } from './create-category.dto'

// `skipNullProperties: false`: a field left out is not changed, but `null` is validated like any other value and
// refused, since the name column is NOT NULL.
export class UpdateCategoryDto
  extends PartialType(CreateCategoryDto, { skipNullProperties: false })
  implements UpdateCategoryInput {}
