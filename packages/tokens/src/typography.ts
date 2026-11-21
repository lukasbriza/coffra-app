// Type scale primitives (unitless px). Font families live per-platform (web loads via
// CSS, RN via expo-font), so only sizes/weights are shared here.

/**
 * Font sizes. `display` is the net amount in the band, `figure` an amount that leads a card and the currency beside
 * the display, `title` the page title, `heading` a card heading, `body` running text and list rows, `label` controls
 * and legends, `caption` the period, a share and a unit. `displayNarrow` replaces `display` on a narrow screen.
 */
export const fontSize = {
  caption: 13,
  label: 14,
  body: 16,
  heading: 18,
  figure: 24,
  title: 28,
  displayNarrow: 40,
  display: 64,
} as const

/** Line heights (unitless px), one per font size, so the design does not depend on a browser default. */
export const lineHeight = {
  caption: 18,
  label: 20,
  body: 24,
  heading: 24,
  figure: 32,
  title: 36,
  displayNarrow: 44,
  display: 68,
} as const

/** Letter spacing (unitless px): `tight` the display, `snug` the title and figures, `normal` everything else. */
export const letterSpacing = { tight: -1.5, snug: -0.4, normal: 0 } as const

export const fontWeight = { regular: '400', medium: '500', semibold: '600', bold: '700' } as const
