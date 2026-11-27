import { fontSize, fontWeight, letterSpacing, lineHeight } from '@lukasbriza/coffra-tokens'
import type { TypographyStyle, TypographyVariantsOptions } from '@mui/material/styles'

import { DISABLED_VARIANTS, FONT_FAMILY, HTML_FONT_SIZE } from './constants'
import type { DesignVariant, FontWeightName, LetterSpacingName } from './types'

/**
 * Converts a pixel value of the tokens to `rem`, so the type scale follows the reader's browser font size.
 *
 * @param px - the token value in pixels
 * @returns the same size in `rem`
 */
const toRem = (px: number): string => `${px / HTML_FONT_SIZE}rem`

/**
 * Builds one typography variant from the tokens of the same name.
 *
 * @param name - the variant, which is also the key of its `fontSize` and `lineHeight` tokens
 * @param weight - the weight the variant has by default; a component may set another one from the theme
 * @param tracking - the letter spacing of the variant
 * @returns the CSS of the variant
 */
const buildVariant = (name: DesignVariant, weight: FontWeightName, tracking: LetterSpacingName): TypographyStyle => ({
  fontFamily: FONT_FAMILY,
  fontSize: toRem(fontSize[name]),
  lineHeight: toRem(lineHeight[name]),
  letterSpacing: `${letterSpacing[tracking]}px`,
  fontWeight: Number(fontWeight[weight]),
})

/**
 * Typography variants of the design, one per `fontSize` token. The default weight and letter spacing of each follow
 * `design/DESIGN.md`: figures, headings and the title bold, labels semibold, the display tight, the title, figures and
 * the narrow display snug.
 */
export const variants: Record<DesignVariant, TypographyStyle> = {
  caption: buildVariant('caption', 'regular', 'normal'),
  label: buildVariant('label', 'semibold', 'normal'),
  body: buildVariant('body', 'regular', 'normal'),
  heading: buildVariant('heading', 'bold', 'normal'),
  figure: buildVariant('figure', 'bold', 'snug'),
  title: buildVariant('title', 'bold', 'snug'),
  displayNarrow: buildVariant('displayNarrow', 'bold', 'snug'),
  display: buildVariant('display', 'bold', 'tight'),
}

const disabledVariants: Partial<Record<(typeof DISABLED_VARIANTS)[number], TypographyStyle>> = Object.fromEntries(
  DISABLED_VARIANTS.map((name) => [name, undefined]),
)

/**
 * Typography options of the theme: the font stack, the four weights of the design, the design's variants and MUI's
 * built-in variants switched off.
 */
export const typography: TypographyVariantsOptions = {
  fontFamily: FONT_FAMILY,
  htmlFontSize: HTML_FONT_SIZE,
  fontWeightRegular: Number(fontWeight.regular),
  fontWeightMedium: Number(fontWeight.medium),
  fontWeightSemibold: Number(fontWeight.semibold),
  fontWeightBold: Number(fontWeight.bold),
  ...disabledVariants,
  ...variants,
}
