import { breakpoint } from '@lukasbriza/coffra-tokens'
import { describe, expect, it } from 'vitest'

import { atMost } from '../src/breakpoints'
import { webTheme } from '../src/web-theme'

describe('breakpoints', () => {
  it('emits max-width queries inclusive of the edge', () => {
    expect(atMost('compact')).toBe('@media (max-width: 1024px)')
    expect(atMost('narrow')).toBe('@media (max-width: 600px)')
  })

  it('is available on the theme', () => {
    expect(webTheme.breakpoints.atMost('compact')).toBe(atMost('compact'))
    expect(webTheme.breakpoints.atMost('narrow')).toBe(atMost('narrow'))
  })

  it('takes its values from the tokens', () => {
    expect(webTheme.breakpoints.values).toEqual({ xs: 0, narrow: breakpoint.narrow, compact: breakpoint.compact })
    expect(webTheme.breakpoints.keys).toEqual(['xs', 'narrow', 'compact'])
  })

  it('leaves no media query of the switched-off MUI breakpoints in the theme', () => {
    expect(JSON.stringify(webTheme)).not.toMatch(/undefinedpx|smpx/)
  })
})
