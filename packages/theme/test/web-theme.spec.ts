import { borderWidth, color, radius, size, spacing } from '@lukasbriza/coffra-tokens'
import type { CSSObject } from '@mui/material/styles'
import { describe, expect, it } from 'vitest'

import { webTheme } from '../src/web-theme'

/**
 * Resolves the global styles the theme adds to `CssBaseline`.
 *
 * @returns the CSS object of the override
 */
const baselineOverrides = (): CSSObject => {
  const overrides = webTheme.components?.MuiCssBaseline?.styleOverrides
  expect(overrides).toBeTypeOf('function')
  return (overrides as (theme: typeof webTheme) => CSSObject)(webTheme)
}

describe('webTheme', () => {
  it('takes the shape from the radius tokens', () => {
    expect(webTheme.shape).toEqual({ borderRadius: radius.md, ...radius })
  })

  it('spaces on the 4 px grid of the tokens', () => {
    expect(webTheme.spacing(1)).toBe(`${spacing(1)}px`)
    expect(webTheme.spacing(3)).toBe('12px')
    expect(webTheme.spacing(10)).toBe(`${spacing(10)}px`)
  })

  it('carries the sizes and stroke widths of the tokens', () => {
    expect(webTheme.size).toEqual(size)
    expect(webTheme.borderWidth).toEqual(borderWidth)
  })

  it('no longer has the generated size scale', () => {
    // @ts-expect-error -- the template's `size0`…`size32` scale is gone
    expect(webTheme.size.size0).toBeUndefined()
  })

  it('sets the body text to the body variant with tabular numerals', () => {
    expect(baselineOverrides().body).toEqual({ ...webTheme.typography.body, fontVariantNumeric: 'tabular-nums' })
  })

  it('draws the focus ring of the design', () => {
    expect(baselineOverrides()[':focus-visible']).toEqual({
      outline: `${borderWidth.focus}px solid ${color.accent.primary}`,
      outlineOffset: `${borderWidth.focus}px`,
    })
  })
})
