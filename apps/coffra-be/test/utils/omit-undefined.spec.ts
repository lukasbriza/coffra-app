import { describe, expect, it } from 'vitest'

import { omitUndefined } from '../../src/utils'

describe('omitUndefined', () => {
  it('drops the undefined properties, so they are absent and not undefined', () => {
    const result = omitUndefined({ name: 'Cash', type: undefined, openingBalance: undefined })

    expect(result).toStrictEqual({ name: 'Cash' })
    expect(Object.keys(result)).toEqual(['name'])
  })

  it('keeps null, false, 0 and the empty string: they are values', () => {
    expect(omitUndefined({ a: null, b: false, c: 0, d: '' })).toStrictEqual({ a: null, b: false, c: 0, d: '' })
  })

  it('returns a new object and leaves the input alone', () => {
    const input = { name: 'Cash', type: undefined }

    expect(omitUndefined(input)).not.toBe(input)
    expect(input).toStrictEqual({ name: 'Cash', type: undefined })
  })

  it('returns an empty object for an input with nothing defined', () => {
    expect(omitUndefined({ name: undefined })).toStrictEqual({})
  })
})
