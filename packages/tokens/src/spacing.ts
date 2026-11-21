// 4px base grid. `spacing(2)` → 8. Unitless number (works for RN and, via a `px`
// wrapper, for the web).
export const spacing = (steps: number) => steps * 4

/**
 * Corner radii (unitless px). `sm` a share bar and a colour key, `md` an icon tile, `lg` a card, `full` a pill:
 * every button and segmented control is fully rounded.
 */
export const radius = { sm: 4, md: 12, lg: 24, full: 999 } as const

/** Stroke widths: `rule` a chart's grid line, `line` a chart's series line, `focus` the ring around a focused control. */
export const borderWidth = { rule: 1, line: 2, focus: 2 } as const

/**
 * Fixed sizes of the layout (unitless px). Everything else in a layout is flex or grid.
 *
 * - `sidebar` — the navigation column on a wide screen.
 * - `content` — the widest the content column grows.
 * - `control` — the height of a button or a segmented control on a wide screen.
 * - `touch` — the smallest tap target on a narrow screen.
 * - `tile` — the round-cornered tile an icon sits on; `icon` — the icon on it; `key` — the colour key of a category.
 * - `ring` — a ring chart on a wide screen; `ringNarrow` — on a narrow one.
 * - `trend` — the height of the month trend's plot.
 * - `bar` — the height of a share bar.
 * - `amount` — the narrowest a column of amounts gets, so `312 000,00 Kč` never wraps.
 * - `shares` — the column of a share row that holds its percentages, fixed so every bar has the same track.
 * - `column` — the narrowest a content column gets while it sits beside another one.
 */
export const size = {
  sidebar: 248,
  content: 1200,
  control: 40,
  touch: 44,
  tile: 36,
  icon: 20,
  key: 10,
  ring: 176,
  ringNarrow: 112,
  trend: 200,
  bar: 6,
  amount: 128,
  shares: 176,
  column: 360,
} as const

/** Widths where the web layout changes (unitless px): the navigation moves at `compact`, rows reflow at `narrow`. */
export const breakpoint = { compact: 1024, narrow: 600 } as const
