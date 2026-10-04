import { describe, expect, it } from 'vitest'

import { isNonEmptyString } from '../../src/utils'

describe('isNonEmptyString', () => {
  it('accepts a string with content', () => {
    expect(isNonEmptyString('dde84b4e')).toBe(true)
  })

  it.each(['', 42, true, null, undefined, {}, ['a']])('rejects %j', (value) => {
    expect(isNonEmptyString(value)).toBe(false)
  })
})
