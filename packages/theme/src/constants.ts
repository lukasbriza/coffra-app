/** Root font size the `rem` values of the type scale are counted from: the browser default, which the app keeps. */
export const HTML_FONT_SIZE = 16

/**
 * CSS custom property an app sets to the font family it loaded for Urbanist (for example through `next/font`).
 * The font stack reads it first, so the loaded font wins over a system copy of Urbanist.
 */
export const FONT_FAMILY_VARIABLE = '--font-urbanist'

/**
 * Font stack of the design: Urbanist, and the platform's sans serif while it loads or when it is missing. Without the
 * custom property the stack falls back to a font named `Urbanist` (a Google Fonts stylesheet, as in Storybook).
 */
export const FONT_FAMILY = `var(${FONT_FAMILY_VARIABLE}, "Urbanist"), "Segoe UI", system-ui, sans-serif`

/**
 * Built-in MUI typography variants the design has no use for. The theme sets them to `undefined` and the types
 * reject them, so only the design's variants can be used. `caption` is not here: the design has its own.
 */
export const DISABLED_VARIANTS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'subtitle1',
  'subtitle2',
  'body1',
  'body2',
  'button',
  'overline',
] as const
