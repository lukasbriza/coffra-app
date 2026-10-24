import { Module } from '@nestjs/common'

import { OwnershipService } from './ownership.service'

/**
 * The ownership layer: the one place that decides whose rows a request sees.
 *
 * Exported through the core barrel. A domain imports this module and not `CoreModule`, which would pull in
 * authentication.
 */
@Module({
  providers: [OwnershipService],
  exports: [OwnershipService],
})
export class OwnershipModule {}
