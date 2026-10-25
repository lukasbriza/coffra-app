import { describe, expect, it } from 'vitest'

import { OTHER_OWNER, OWNER, useOwnershipService } from './setup'

describe('OwnershipService.ownerData', () => {
  const { service } = useOwnershipService()

  it('makes the owner the owner of the new row, with no other column', () => {
    expect(service().ownerData(OWNER)).toStrictEqual({ userId: OWNER.userId })
    expect(service().ownerData(OTHER_OWNER)).toStrictEqual({ userId: OTHER_OWNER.userId })
  })

  it('never writes tenantId in the MVP, so the column stays NULL', () => {
    expect(service().ownerData(OWNER)).not.toHaveProperty('tenantId')
  })

  it('returns a new object on every call', () => {
    const first = service().ownerData(OWNER)
    first.userId = OTHER_OWNER.userId

    expect(service().ownerData(OWNER)).toStrictEqual({ userId: OWNER.userId })
  })
})
