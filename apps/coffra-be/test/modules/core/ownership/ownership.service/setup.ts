import 'reflect-metadata'

import { Inject, Injectable } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { beforeEach } from 'vitest'

import { OwnershipModule } from '../../../../../src/modules/core/ownership/ownership.module'
import { OwnershipService } from '../../../../../src/modules/core/ownership/ownership.service'
import type { Owner } from '../../../../../src/modules/core/ownership/ownership.types'

// Shared by the use case specs of `OwnershipService` (scope, ownerData, orNotFound).

export const OWNER: Owner = { userId: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11' }
export const OTHER_OWNER: Owner = { userId: '7d1c2b9a-5e4f-4a3b-8c2d-1e0f9a8b7c62' }

/** Stands in for a domain service: it can inject `OwnershipService` only if `OwnershipModule` exports it. */
@Injectable()
class DomainServiceProbe {
  constructor(@Inject(OwnershipService) readonly ownership: OwnershipService) {}
}

/**
 * The service as a domain gets it, through `OwnershipModule`. Call it inside a `describe`: it registers the
 * `beforeEach` that builds a fresh one for that block.
 */
export const useOwnershipService = () => {
  let service: OwnershipService

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [OwnershipModule],
      providers: [DomainServiceProbe],
    }).compile()

    service = moduleRef.get(DomainServiceProbe).ownership
  })

  return { service: (): OwnershipService => service }
}
