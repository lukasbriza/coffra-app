import { borderWidth, radius, size, spacing } from '@lukasbriza/coffra-tokens'
import { createTheme } from '@mui/material/styles'

import { breakpoints } from './breakpoints'
import { components } from './components'
import { palette } from './palette'
import { typography } from './typography'

/**
 * The MUI theme of the Coffra design, composed from `@lukasbriza/coffra-tokens`.
 *
 * Every design value comes from a token: the palette and typography, `shape` from `radius` (`borderRadius`, which MUI
 * requires, is `radius.md`), `spacing` on the 4 px grid, and the design's own `size` and `borderWidth`. It has no
 * `'use client'`, so a server component can read its values; `ThemeProvider` puts it into React context.
 */
export const webTheme = createTheme({
  borderWidth: { ...borderWidth },
  breakpoints,
  components,
  // MUI builds the toolbar mixin from the `sm` breakpoint, which this theme does not have.
  mixins: { toolbar: {} },
  palette,
  shape: { borderRadius: radius.md, ...radius },
  size: { ...size },
  spacing,
  typography,
})
