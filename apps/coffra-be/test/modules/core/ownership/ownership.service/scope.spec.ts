import { describe, expect, it } from 'vitest'

import { OTHER_OWNER, OWNER, useOwnershipService } from './setup'

describe('OwnershipService.scope', () => {
  const { service } = useOwnershipService()

  it('limits a query to the rows of the owner, with nothing else in the filter', () => {
    expect(service().scope(OWNER)).toStrictEqual({ userId: OWNER.userId })
  })

  it('never puts tenantId into the filter in the MVP', () => {
    expect(service().scope(OWNER)).not.toHaveProperty('tenantId')
  })

  it('gives each owner its own scope', () => {
    expect(service().scope(OTHER_OWNER)).toStrictEqual({ userId: OTHER_OWNER.userId })
    expect(service().scope(OTHER_OWNER)).not.toEqual(service().scope(OWNER))
  })

  it('spreads into a where next to the id, and through a parent relation', () => {
    const scope = service().scope(OWNER)
    const id = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d'

    expect({ id, ...scope }).toStrictEqual({ id, userId: OWNER.userId })
    expect({ account: scope }).toStrictEqual({ account: { userId: OWNER.userId } })
  })

  it('returns a new object on every call, so changing one query does not leak into the next', () => {
    const first = service().scope(OWNER)
    first.userId = OTHER_OWNER.userId

    expect(service().scope(OWNER)).toStrictEqual({ userId: OWNER.userId })
    expect(OWNER).toStrictEqual({ userId: '0b0f7f3e-3c55-4a43-9d33-6a0c1f7f4a11' })
  })
})
