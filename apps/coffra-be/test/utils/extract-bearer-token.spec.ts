import { describe, expect, it } from 'vitest'

import { extractBearerToken } from '../../src/utils'

describe('extractBearerToken', () => {
  it('returns the token after the Bearer scheme', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi')
  })

  it.each(['bearer', 'BEARER', 'BeArEr'])('accepts the scheme %s regardless of case', (scheme) => {
    expect(extractBearerToken(`${scheme} abc`)).toBe('abc')
  })

  it('accepts more than one space after the scheme', () => {
    expect(extractBearerToken('Bearer   abc')).toBe('abc')
  })

  it.each([undefined, '', 'Bearer', 'Bearer ', 'Basic abc', 'abc', 'Bearerabc', 'Bearer a b', ' Bearer abc'])(
    'gives undefined for %j',
    (header) => {
      expect(extractBearerToken(header)).toBeUndefined()
    },
  )
})
