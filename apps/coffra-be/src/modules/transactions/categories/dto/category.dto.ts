import { ApiProperty } from '@nestjs/swagger'

import type { CategoryView } from '../categories.types'

/** Swagger shape of `CategoryView`. */
export class CategoryDto implements CategoryView {
  @ApiProperty({ format: 'uuid' })
  id!: string

  @ApiProperty({ example: 'Food' })
  name!: string
}
