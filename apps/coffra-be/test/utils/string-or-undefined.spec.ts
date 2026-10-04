import { describe, expect, it } from 'vitest'

import { stringOrUndefined } from '../../src/utils'

describe('stringOrUndefined', () => {
  it('returns strings unchanged, including the empty string', () => {
    expect(stringOrUndefined('dev@coffra.local')).toBe('dev@coffra.local')
    expect(stringOrUndefined('')).toBe('')
  })

  it.each([42, true, null, undefined, {}, ['a']])('returns undefined for %j', (value) => {
    expect(stringOrUndefined(value)).toBeUndefined()
  })
})
