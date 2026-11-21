// Framework-free brand palette (plain data — no MUI/emotion/React). Both the web
// MUI theme and the mobile @emotion/native theme compose their own theme objects
// from these primitives, so colours stay defined in exactly one place.

export const gray = '#27292c'
export const black = '#151617'
export const white = '#ffffff'

export const mono = {
  1: '#eeeeee',
  2: '#aeaeae',
  3: '#909090',
  4: '#5c5c5c',
} as const

export const state = {
  success: { primary: '#51a147', secondary: '#73976e' },
  warning: { primary: '#e8c53c', secondary: '#d7c066' },
  error: { primary: '#b72121', secondary: '#873434' },
} as const

export const palette = { gray, black, white, mono, state } as const

/**
 * Colour roles of the Coffra design, recorded in `design/DESIGN.md`. One token set: a light page with one dark band
 * at the top of a screen.
 *
 * - `bg` — the light surfaces: the page behind everything, the cards on it, a recessed track or tile.
 * - `text` — two levels of text on the light surfaces, plus text on the accent.
 * - `accent` — the one accent: the primary action, the current navigation item and the focus ring. `soft` is its
 *   tint behind the current navigation item.
 * - `amount` — the sign of an amount on a light surface: more earned than spent, or more spent than earned.
 * - `band` — the dark band at the top of a screen: its background, the cards on it, the track of a segmented
 *   control and its selected segment, its two text levels and the sign of an amount on it.
 * - `chart` — `series1`…`series5` are the five largest categories of a ring chart in their fixed order and `other`
 *   is "Ostatní"; `income`, `expense`, `expenseArea`, `gainArea`, `lossArea` and `grid` draw the month trend; `track`
 *   is behind a share bar.
 */
export const color = {
  bg: {
    page: '#f3f4f8',
    surface: '#ffffff',
    sunken: '#eaecf2',
  },
  text: {
    primary: '#14161f',
    secondary: '#5a5f70',
    onAccent: '#ffffff',
  },
  accent: {
    primary: '#4b4ee8',
    soft: '#e6e7fc',
  },
  amount: {
    positive: '#187a3e',
    negative: '#c0362c',
  },
  band: {
    bg: '#12141c',
    surface: '#1d2030',
    track: '#2a2e42',
    selected: '#ffffff',
    text: {
      primary: '#f4f5fa',
      secondary: '#a4a9bd',
      onSelected: '#14161f',
    },
    amount: {
      positive: '#5fd68b',
      negative: '#ff8a80',
    },
  },
  chart: {
    series1: '#9085e9',
    series2: '#d95926',
    series3: '#2b9fc4',
    series4: '#c98500',
    series5: '#d55181',
    other: '#a3a7b8',
    income: '#14161f',
    expense: '#5a5f70',
    expenseArea: '#d3d6e1',
    gainArea: '#cdebd8',
    lossArea: '#f6d5d1',
    grid: '#e4e6ee',
    track: '#eaecf2',
  },
} as const
