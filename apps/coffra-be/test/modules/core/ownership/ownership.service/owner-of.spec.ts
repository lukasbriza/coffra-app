import { describe, expect, it } from 'vitest'

import { OTHER_OWNER, OWNER, useOwnershipService } from './setup'

describe('OwnershipService.ownerOf', () => {
  const { service } = useOwnershipService()

  it('builds the owner whose data belong to the user', () => {
    expect(service().ownerOf(OWNER.userId)).toStrictEqual(OWNER)
  })

  it('gives the scope of that user, the same a request of the user gets', () => {
    expect(service().scope(service().ownerOf(OWNER.userId))).toStrictEqual(service().scope(OWNER))
    expect(service().scope(service().ownerOf(OTHER_OWNER.userId))).toStrictEqual({ userId: OTHER_OWNER.userId })
  })

  it('returns a new object on every call', () => {
    expect(service().ownerOf(OWNER.userId)).not.toBe(service().ownerOf(OWNER.userId))
  })
})
