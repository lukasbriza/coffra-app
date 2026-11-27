import { fontSize, fontWeight, letterSpacing, lineHeight } from '@lukasbriza/coffra-tokens'
import { describe, expect, it } from 'vitest'

import { DISABLED_VARIANTS, FONT_FAMILY_VARIABLE, HTML_FONT_SIZE } from '../src/constants'
import type { DesignVariant, FontWeightName, LetterSpacingName } from '../src/types'
import { webTheme } from '../src/web-theme'

const { typography } = webTheme

/**
 * Converts a `rem` value of the theme back to pixels.
 *
 * @param value - a CSS length in `rem`
 * @returns the length in pixels
 */
const remToPx = (value: unknown): number => {
  expect(value).toMatch(/^[\d.]+rem$/)
  return Number.parseFloat(String(value)) * HTML_FONT_SIZE
}

// Weight and letter spacing of each variant, as `design/DESIGN.md` → Web gives them.
const DESIGN: [DesignVariant, FontWeightName, LetterSpacingName][] = [
  ['caption', 'regular', 'normal'],
  ['label', 'semibold', 'normal'],
  ['body', 'regular', 'normal'],
  ['heading', 'bold', 'normal'],
  ['figure', 'bold', 'snug'],
  ['title', 'bold', 'snug'],
  ['displayNarrow', 'bold', 'snug'],
  ['display', 'bold', 'tight'],
]

describe('typography', () => {
  it('has a variant for every font size token', () => {
    expect(DESIGN.map(([variant]) => variant).toSorted()).toEqual(Object.keys(fontSize).toSorted())
  })

  it.each(DESIGN)('builds %s from its tokens', (variant, weight, tracking) => {
    const style = typography[variant]

    expect(remToPx(style.fontSize)).toBe(fontSize[variant])
    expect(remToPx(style.lineHeight)).toBe(lineHeight[variant])
    expect(style.letterSpacing).toBe(`${letterSpacing[tracking]}px`)
    expect(style.fontWeight).toBe(Number(fontWeight[weight]))
    expect(style.fontFamily).toBe(typography.fontFamily)
  })

  it('sets Urbanist first, read from the app variable with the family name as fallback', () => {
    expect(typography.fontFamily).toBe(`var(${FONT_FAMILY_VARIABLE}, "Urbanist"), "Segoe UI", system-ui, sans-serif`)
    expect(typography.htmlFontSize).toBe(16)
  })

  it('carries the four weights of the tokens', () => {
    expect(typography.fontWeightRegular).toBe(Number(fontWeight.regular))
    expect(typography.fontWeightMedium).toBe(Number(fontWeight.medium))
    expect(typography.fontWeightSemibold).toBe(Number(fontWeight.semibold))
    expect(typography.fontWeightBold).toBe(Number(fontWeight.bold))
  })

  it.each(DISABLED_VARIANTS)('switches off the built-in %s variant', (variant) => {
    expect(typography[variant]).toBeUndefined()
  })

  it('no longer has the template variants', () => {
    // @ts-expect-error -- the template's `S` variant is gone
    expect(typography.S).toBeUndefined()
    // @ts-expect-error -- the template's `XL` variant is gone
    expect(typography.XL).toBeUndefined()
  })
})
