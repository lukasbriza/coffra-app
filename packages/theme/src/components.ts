import type { Components, Theme } from '@mui/material/styles'

/**
 * Global styles and component defaults of the theme.
 *
 * - `MuiCssBaseline` sets the body text to the `body` variant with tabular numerals and draws the design's focus ring
 *   on every focused element; the page background and the text colour come from `CssBaseline` itself.
 * - `MuiTypography` renders the title, a heading and body text as their HTML elements; other variants are a `span`.
 */
export const components: Components<Omit<Theme, 'components'>> = {
  MuiCssBaseline: {
    styleOverrides: (theme) => ({
      body: { ...theme.typography.body, fontVariantNumeric: 'tabular-nums' },
      ':focus-visible': {
        outline: `${theme.borderWidth.focus}px solid ${theme.palette.accent.primary}`,
        outlineOffset: `${theme.borderWidth.focus}px`,
      },
    }),
  },
  MuiTypography: {
    defaultProps: {
      variantMapping: { title: 'h1', heading: 'h2', body: 'p' },
    },
  },
}
