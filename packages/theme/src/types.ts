/* eslint-disable @typescript-eslint/consistent-type-definitions -- MUI augmentation needs interfaces */
import type {
  borderWidth,
  breakpoint,
  color,
  fontSize,
  fontWeight,
  letterSpacing,
  radius,
  size,
} from '@lukasbriza/coffra-tokens'
import type { TypographyStyle } from '@mui/material/styles'

import type { webTheme } from './web-theme'

/**
 * Type of a token group with its literal values widened to `string` and `number` and without `readonly`, so a theme
 * built from other values still fits it. The keys stay the token keys: a new token shows up in the theme type.
 */
export type Widened<T> = {
  -readonly [K in keyof T]: T[K] extends string ? string : T[K] extends number ? number : Widened<T[K]>
}

/**
 * Colour groups of the design that have no MUI role, named after the token roles in `color`.
 *
 * @property accent - the accent (`primary`) and its tint (`soft`) behind the current navigation item
 * @property amount - the sign of an amount on a light surface
 * @property band - the dark band at the top of a screen: its surfaces, text and the sign of an amount on it
 * @property chart - the ring slices (`series1`…`series5`, `other`), the month trend and the share bar track
 */
export type WebPalette = Widened<Pick<typeof color, 'accent' | 'amount' | 'band' | 'chart'>>

/** Corner radii of the design on `theme.shape`: `sm`, `md`, `lg`, `full` (unitless px). */
export type WebShape = Widened<typeof radius>

/** Fixed layout sizes of the design on `theme.size` (unitless px). */
export type WebSize = Widened<typeof size>

/** Stroke widths of the design on `theme.borderWidth`: `rule`, `line`, `focus` (unitless px). */
export type WebBorderWidth = Widened<typeof borderWidth>

/** Breakpoint of the design where the web layout changes: `compact` (1024) or `narrow` (600). */
export type DesignBreakpoint = keyof typeof breakpoint

/** Typography variant of the design, one per `fontSize` token. */
export type DesignVariant = keyof typeof fontSize

/** Name of a font weight token: `regular`, `medium`, `semibold` or `bold`. */
export type FontWeightName = keyof typeof fontWeight

/** Name of a letter spacing token: `tight`, `snug` or `normal`. */
export type LetterSpacingName = keyof typeof letterSpacing

/**
 * Typography the design adds to MUI's: its variants (`caption` is MUI's own and only changes its values) and the
 * semibold weight, which MUI has no slot for.
 *
 * @property fontWeightSemibold - the semibold weight (600) of labels, legend shares and list names
 */
export type WebTypographyVariants = Record<Exclude<DesignVariant, 'caption'>, TypographyStyle> & {
  fontWeightSemibold: number
}

export type { Theme } from '@mui/material/styles'

/** The type of `webTheme`: MUI's `Theme` with the design's additions below. */
export type WebTheme = typeof webTheme

// --- MUI module augmentation ---
declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    label: true
    body: true
    heading: true
    figure: true
    title: true
    displayNarrow: true
    display: true
    h1: false
    h2: false
    h3: false
    h4: false
    h5: false
    h6: false
    subtitle1: false
    subtitle2: false
    body1: false
    body2: false
    button: false
    overline: false
  }
}

declare module '@mui/material/styles' {
  interface Palette extends WebPalette {}
  interface PaletteOptions extends Partial<WebPalette> {}
  interface TypeBackground {
    sunken: string
  }
  interface TypeText {
    onAccent: string
  }
  interface Shape extends WebShape {}
  interface ShapeOptions extends Partial<WebShape> {}
  interface TypographyVariants extends WebTypographyVariants {}
  interface TypographyVariantsOptions extends Partial<WebTypographyVariants> {}
  interface BreakpointOverrides {
    xs: true
    sm: false
    md: false
    lg: false
    xl: false
    narrow: true
    compact: true
  }
  interface Breakpoints {
    atMost: (key: DesignBreakpoint) => string
  }
  interface Theme {
    borderWidth: WebBorderWidth
    size: WebSize
  }
  interface ThemeOptions {
    borderWidth?: WebBorderWidth
    size?: WebSize
  }
}

declare module '@mui/system' {
  interface Shape extends WebShape {}
}
