import { Module } from '@nestjs/common'

import { OwnershipModule } from '../../core'

import { CategoriesController } from './categories.controller'
import { CategoriesService } from './categories.service'

/**
 * The categories of the signed-in user: `/api/categories`.
 *
 * Imports `OwnershipModule` and not `CoreModule`: the domain needs the ownership layer only, not auth. `PrismaModule`
 * is global.
 */
@Module({
  imports: [OwnershipModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
