import { describe, expect, it } from 'vitest'

import { idOf } from '../../../../scripts/seed/utils/id-of'

describe('idOf', () => {
  const ids = new Map([['Main', 'id-main']])

  it('gives the id of a name', () => {
    expect(idOf(ids, 'Main', 'account')).toBe('id-main')
  })

  it('refuses a name the data does not define, and says which', () => {
    expect(() => idOf(ids, 'Savings', 'account')).toThrow(
      'The data refers to the account "Savings", which it does not define.',
    )
  })
})
