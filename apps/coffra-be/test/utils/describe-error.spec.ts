import { describe, expect, it } from 'vitest'

import { describeError } from '../../src/utils'

class CodedError extends Error {
  constructor(
    message: string,
    readonly code: unknown,
  ) {
    super(message)
    this.name = 'CodedError'
  }
}

describe('describeError', () => {
  it('returns the error class name', () => {
    expect(describeError(new TypeError('boom'))).toBe('TypeError')
  })

  it('appends a string code', () => {
    expect(describeError(new CodedError('boom', 'OAUTH_INVALID_RESPONSE'))).toBe('CodedError OAUTH_INVALID_RESPONSE')
  })

  it('ignores a code that is not a string', () => {
    expect(describeError(new CodedError('boom', 42))).toBe('CodedError')
  })

  it('never includes the message', () => {
    expect(describeError(new CodedError('secret-token-123', 'E_CODE'))).not.toContain('secret-token-123')
  })

  it.each(['text', 42, null, undefined, { name: 'Fake' }])('returns a placeholder for non-Error %j', (value) => {
    expect(describeError(value)).toBe('unknown error')
  })
})
