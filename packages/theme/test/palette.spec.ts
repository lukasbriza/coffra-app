import { color } from '@lukasbriza/coffra-tokens'
import { describe, expect, expectTypeOf, it } from 'vitest'

import { webTheme } from '../src/web-theme'

const { palette } = webTheme

describe('palette', () => {
  it('is the light mode of the design', () => {
    expect(palette.mode).toBe('light')
  })

  it('maps the MUI roles to the design tokens', () => {
    expect(palette.primary.main).toBe(color.accent.primary)
    expect(palette.primary.contrastText).toBe(color.text.onAccent)
    expect(palette.background.default).toBe(color.bg.page)
    expect(palette.background.paper).toBe(color.bg.surface)
    expect(palette.background.sunken).toBe(color.bg.sunken)
    expect(palette.text.primary).toBe(color.text.primary)
    expect(palette.text.secondary).toBe(color.text.secondary)
    expect(palette.text.onAccent).toBe(color.text.onAccent)
  })

  it.each(['accent', 'amount', 'band', 'chart'] as const)('carries the %s group of the tokens unchanged', (group) => {
    expect(palette[group]).toEqual(color[group])
  })

  it('types the design roles as strings', () => {
    expectTypeOf(palette.band.bg).toEqualTypeOf<string>()
    expectTypeOf(palette.band.text.onSelected).toEqualTypeOf<string>()
    expectTypeOf(palette.band.amount.negative).toEqualTypeOf<string>()
    expectTypeOf(palette.chart.series1).toEqualTypeOf<string>()
    expectTypeOf(palette.chart.lossArea).toEqualTypeOf<string>()
    expectTypeOf(palette.amount.positive).toEqualTypeOf<string>()
    expectTypeOf(palette.accent.soft).toEqualTypeOf<string>()
    expectTypeOf(palette.background.sunken).toEqualTypeOf<string>()
    expectTypeOf(palette.text.onAccent).toEqualTypeOf<string>()
  })

  it('no longer has the template groups', () => {
    // @ts-expect-error -- the template's `bodyText` group is gone
    expect(palette.bodyText).toBeUndefined()
    // @ts-expect-error -- the template's `surface` group is gone
    expect(palette.surface).toBeUndefined()
  })
})
