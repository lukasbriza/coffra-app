import { ApiProperty } from '@nestjs/swagger'

import { RESOURCE_NAME_MAX_LENGTH } from '../../common/constants'
import { IsResourceName } from '../../common/decorators/is-resource-name.decorator'
import type { CreateCategoryInput } from '../categories.types'

/** Body of `POST /api/categories`. */
export class CreateCategoryDto implements CreateCategoryInput {
  @ApiProperty({
    description: 'Trimmed, unique per user, case-sensitive: `Food` and `food` are two categories',
    example: 'Food',
    maxLength: RESOURCE_NAME_MAX_LENGTH,
  })
  @IsResourceName()
  name!: string
}
