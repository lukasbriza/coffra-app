import { Module } from '@nestjs/common'

import { OwnershipModule } from '../../core'

import { CategoriesController } from './categories.controller'
import { CategoriesService } from './categories.service'

// `OwnershipModule`, not `CoreModule`: the domain needs the ownership layer only, not auth. `PrismaModule` is global.
@Module({
  imports: [OwnershipModule],
  controllers: [CategoriesController],
  providers: [CategoriesService],
})
export class CategoriesModule {}
