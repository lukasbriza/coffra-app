import { describe, expect, it } from 'vitest'

import { sortKeys } from '../../../../scripts/openapi/utils/sort-keys'

describe('sortKeys', () => {
  it('orders the keys by code units, not by the rules of a locale', () => {
    const sorted = sortKeys({ a: 1, Á: 2, _: 3, B: 4 }) as Record<string, number>

    // `localeCompare` would put `_` first and `B` after `a`.
    expect(Object.keys(sorted)).toStrictEqual(['B', '_', 'a', 'Á'])
  })

  it('sorts the objects inside arrays and nested objects', () => {
    expect(JSON.stringify(sortKeys({ list: [{ y: 1, x: { d: 1, c: 2 } }] }))).toBe(
      '{"list":[{"x":{"c":2,"d":1},"y":1}]}',
    )
  })

  it('keeps arrays in their order', () => {
    expect(sortKeys(['b', 'a', { z: 1 }, 'c'])).toStrictEqual(['b', 'a', { z: 1 }, 'c'])
  })

  it('puts keys that are numbers first, in numeric order, as JavaScript always does', () => {
    expect(Object.keys(sortKeys({ default: 1, '404': 2, '200': 3 }) as object)).toStrictEqual(['200', '404', 'default'])
  })

  it.each([null, 'text', 42, true])('returns %j as it is', (value) => {
    expect(sortKeys(value)).toBe(value)
  })

  it('leaves the input as it was', () => {
    const input = { b: { d: 1, c: 2 }, a: [3, 1] }

    sortKeys(input)

    expect(JSON.stringify(input)).toBe('{"b":{"d":1,"c":2},"a":[3,1]}')
  })
})
