import { color } from '@lukasbriza/coffra-tokens'
import type { PaletteOptions } from '@mui/material/styles'

/**
 * Palette of the design in light mode, composed from the colour roles of `@lukasbriza/coffra-tokens`.
 *
 * MUI's own roles take the matching token: `primary` is the accent, `background` the light surfaces and `text` the
 * text levels, so `sx` shorthands such as `color: 'text.secondary'` follow the design. The design's own groups
 * (`accent`, `amount`, `band`, `chart`) keep the token names one to one. `primary.light` and `primary.dark` are
 * derived by MUI; the design has no such roles.
 */
export const palette: PaletteOptions = {
  mode: 'light',
  primary: { main: color.accent.primary, contrastText: color.text.onAccent },
  background: { default: color.bg.page, paper: color.bg.surface, sunken: color.bg.sunken },
  text: { primary: color.text.primary, secondary: color.text.secondary, onAccent: color.text.onAccent },
  accent: color.accent,
  amount: color.amount,
  band: color.band,
  chart: color.chart,
}
