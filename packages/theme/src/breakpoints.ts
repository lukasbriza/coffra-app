import { breakpoint } from '@lukasbriza/coffra-tokens'
import type { BreakpointsOptions } from '@mui/material/styles'

import type { DesignBreakpoint } from './types'

/**
 * Builds a media query for screens up to and including the width of a breakpoint of the design.
 *
 * The design's layout changes at `≤ 1024` and `≤ 600`, while MUI's `down()` stops just below the value
 * (`max-width: 1023.95px`), so styles of the design use this instead.
 *
 * @param key - the breakpoint
 * @returns the `@media` rule, for example `@media (max-width: 1024px)`
 */
export const atMost = (key: DesignBreakpoint): string => `@media (max-width: ${breakpoint[key]}px)`

/**
 * Breakpoints of the theme: `xs` starts the scale, `narrow` and `compact` come from the tokens. MUI's `sm`, `md`,
 * `lg` and `xl` are switched off; `atMost` is available as `theme.breakpoints.atMost`.
 */
export const breakpoints: BreakpointsOptions = {
  values: { xs: 0, narrow: breakpoint.narrow, compact: breakpoint.compact },
  atMost,
}
