import { PartialType } from '@nestjs/swagger'

import type { UpdateCategoryInput } from '../categories.types'

import { CreateCategoryDto } from './create-category.dto'

/**
 * Body of `PATCH /api/categories/:id`: any field of a create.
 *
 * `skipNullProperties: false` makes a field that is left out stay as it is, while `null` is validated like any other
 * value and refused, since the name column is NOT NULL.
 */
export class UpdateCategoryDto
  extends PartialType(CreateCategoryDto, { skipNullProperties: false })
  implements UpdateCategoryInput {}
