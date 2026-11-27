'use client'

import { CssBaseline, ThemeProvider as MuiThemeProvider } from '@mui/material'
import type { ThemeProviderProps } from '@mui/material/styles'

import { webTheme } from './web-theme'

/**
 * Provides the Coffra theme to its children and applies the theme's global baseline (`CssBaseline`).
 *
 * @param props - the children, and optionally `theme` to render with instead of `webTheme` (a story or a test)
 * @returns the children under the theme
 */
export const ThemeProvider = ({ children, theme = webTheme }: Partial<ThemeProviderProps>) => (
  <MuiThemeProvider theme={theme}>
    <CssBaseline />
    {children}
  </MuiThemeProvider>
)

export { useTheme } from '@mui/material/styles'
