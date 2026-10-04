import { Logger } from '@nestjs/common'
import { afterEach, beforeEach, vi } from 'vitest'

/**
 * For specs of services that log a warning for every rejection. Call it inside a `describe`: silences the
 * expected warnings (a test can still inspect them through the returned spy) and puts the clock back after
 * tests that moved it.
 */
export const useQuietWarnings = () => {
  const warn = vi.spyOn(Logger.prototype, 'warn')

  beforeEach(() => {
    warn.mockReset().mockImplementation(() => {
      // keeps expected warnings out of the test output
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  return { warn }
}
