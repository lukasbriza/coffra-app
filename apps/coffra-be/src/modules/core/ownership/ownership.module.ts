import { Module } from '@nestjs/common'

import { OwnershipService } from './ownership.service'

// Exported through the core barrel: a domain imports this module, not CoreModule, which would pull in auth.
@Module({
  providers: [OwnershipService],
  exports: [OwnershipService],
})
export class OwnershipModule {}
