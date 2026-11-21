# Components — web (apps/coffra-web)

How the web realises each entry of `design/components.md`. A component on two web screens has identical markup and
identical tokens on both; a variant is a state on the existing entry. Reference screen:
`design/screens/dashboard.html`.

## Amount

- Shared entry: design/components.md#amount
- Markup: any element with `class="amount"`; the text is the `cs-CZ` currency format with no-break spaces
  (`312&nbsp;000,00&nbsp;Kč`). In a headline: `p.headline` → `span.headline__value` (`+158&nbsp;842,00`) +
  `span.headline__unit` (`Kč`), `headline--positive` / `headline--negative` for the sign.
- Tokens used: --font-family-text (tabular numerals on `body`), --color-band-amount-positive,
  --color-band-amount-negative, --color-amount-positive, --color-amount-negative
- Platform notes: `white-space: nowrap` always; size comes from the parent role.

## Navigation

- Shared entry: design/components.md#navigation
- Markup: wide — `<aside class="sidebar" data-layer="Navigation / Sidebar">` (grid area `nav`, spanning both rows)
  with `p.wordmark`, `<nav data-layer="Navigation / Money">` (group label + `a.nav-item`, each an Icon tile + label),
  an empty `div.sidebar__room` that later module groups go into, and `div.sidebar__account` (email + Nastavení). Narrow — `<header data-layer="Navigation / Top
  bar">` (wordmark + Primary action, on `band.bg`) and `<nav data-layer="Navigation / Tab bar">` with the same five
  `a.nav-item`. The current item carries `aria-current="page"`.
- Tokens used: --size-sidebar, --size-touch, --size-tile, --color-bg-surface, --color-accent-soft,
  --color-accent-primary, --color-text-on-accent, --color-text-primary, --color-text-secondary,
  --radius-full, --font-size-label, --font-size-caption, --font-weight-medium, --font-weight-bold
- Platform notes: sidebar above 1024; top bar and tab bar (both sticky) at 1024 and below. The tab bar holds five
  items at 390 — the most it can. The sidebar is a solid white column over the full height (grid area `nav`,
  spanning the band and the detail rows); it meets the band on a straight vertical edge. At ≤ 1024 the page grid's
  rows are `auto auto 1fr auto` (top bar, band, content, tab bar), so extra height goes to the content, never the
  bars.

## Icon tile

- Shared entry: design/components.md#icon-tile
- Markup: `<span class="tile" data-layer="Icon tile">` around one `svg.icon` (24 viewBox, stroked paths,
  `aria-hidden`).
- Tokens used: --size-tile, --size-icon, --radius-md, --radius-full, --color-bg-sunken, --color-band-track,
  --border-width-line
- Platform notes: round (`radius-full`) in navigation, square-rounded (`radius-md`) in the Sum; hidden in the Sum at
  600 and below.

## Primary action

- Shared entry: design/components.md#primary-action
- Markup: `<a data-layer="Primary action" class="primary-action">` with a plus `svg.icon` and the verb (`Přidat
  transakci`).
- Tokens used: --color-accent-primary, --color-text-on-accent, --radius-full, --size-control, --size-touch,
  --space-2 … --space-5, --font-size-label, --font-weight-bold
- Platform notes: in the band's header above 1024, in the top bar at 1024 and below (44 px high there). Focus ring:
  the global `:focus-visible` outline (--border-width-focus, --color-accent-primary).

## Segmented control

- Shared entry: design/components.md#segmented-control
- Markup: `<div class="segmented" role="group" aria-label="…">` with `button.segmented__segment` (`aria-pressed`).
  Currency switch: `aria-label="Měna"`, segments `CZK`, `EUR`. Period control: `segmented--period`,
  `aria-label="Období"`, segments `3 měsíce`, `6 měsíců`, `1 rok` for `3m`, `6m`, `1y`.
- Tokens used: --color-band-track, --color-band-selected, --color-band-text-on-selected,
  --color-band-text-secondary, --radius-full, --size-control, --size-touch, --space-1 … --space-4,
  --font-size-label, --font-weight-semibold
- Platform notes: at 600 and below both sit on one row, the period control takes the remaining width with equal
  segments, and every segment is 44 px high with the track.

## Verdict

- Shared entry: design/components.md#verdict
- Markup: `<section data-layer="Dashboard / Verdict" class="verdict">` → `div.verdict__main` (`h2.verdict__text`,
  the Amount headline, `p.caption` with the window) + the Sum.
- Tokens used: --font-size-heading, --font-size-display, --font-size-display-narrow, --font-size-figure, the matching
  --line-height-*, --letter-spacing-tight, --letter-spacing-snug, --color-band-text-secondary, --space-1 … --space-10
- Platform notes: the Sum sits right of the net and wraps under it when both do not fit.

## Sum

- Shared entry: design/components.md#sum
- Markup: `<div class="sum" data-layer="Sum">` with three `div.sum__item` (`Income`, `Expense`, `Investable`): Icon
  tile, `p.sum__label` (`span.sum__name` + `span.caption` with the period), `p.sum__value`.
- Tokens used: --color-band-surface, --color-band-track, --radius-lg, --size-column, --size-tile, --space-3 …
  --space-6, --font-size-label, --font-size-heading, --font-size-caption
- Platform notes: a column of three rows on a card above 1024; one row of three (tile beside label and value) at
  1024 and below; at 600 and below no card and no tiles, three plain figures in one row.

## Ring chart

- Shared entry: design/components.md#ring-chart
- Markup: `<article class="ring-card" data-layer="Ring card / Expense|Income">` → `div.ring-card__head` (`h3` with the
  side and period, `p.caption`, `p.ring-card__total`) → `div.ring-card__body` with `div.ring` (an inline
  `svg viewBox="0 0 176 176"` of `path.slice--1` … `slice--5`, `slice--other`, plus `p.ring__centre` in the same grid
  cell) and `ol.legend` of `li.legend-row` (`span.key key--N`, name, amount, share). Slice paths are precomputed
  annular sectors (outer radius 88, inner 60, 2 px gap) — geometry is data, the colour is a class.
- Tokens used: --color-band-surface, --color-chart-series-1 … --color-chart-series-5, --color-chart-other,
  --size-ring, --size-ring-narrow, --size-key, --size-column, --radius-lg, --radius-md, --radius-sm,
  --font-size-figure, --font-size-heading, --font-size-label, --font-size-caption, --font-weight-semibold
- Platform notes: the two cards side by side at every width. The legend sits beside the ring while it gets at least
  two thirds of `size.column`, otherwise under it (always under it at 1024 and below). At 600 and below the card
  drops its caption and total (both are in the Sum), and the legend drops the amounts.

## Month trend

- Shared entry: design/components.md#month-trend
- Markup: `<section class="card" data-layer="Month trend">` → head (title, caption, `ul.trend-legend`) →
  `div.trend` (`div.trend__axis` with four `Kč` labels, `div.trend__plot` → `div.trend__frame` with an inline
  `svg viewBox="0 0 600 200" preserveAspectRatio="none"` and `div.trend__months`) → `p.trend__note`.
- Tokens used: --color-chart-income, --color-chart-expense, --color-chart-expense-area, --color-chart-gain-area,
  --color-chart-loss-area, --color-chart-grid, --border-width-line, --border-width-rule, --size-trend,
  --line-height-caption, --color-bg-sunken, --radius-md, --radius-lg
- Platform notes: the plot stretches to its width; lines and grid keep their stroke with
  `vector-effect: non-scaling-stroke`. Axis labels are HTML, so they never scale. Curves are monotone cubic through
  the month points; the gain area is the path between the income line and the expense line. A hover crosshair with
  the month's three figures is an implementation concern and not drawn.

## Share list

- Shared entry: design/components.md#share-list
- Markup: `<section class="card" data-layer="Share list / Expense|Income">` → head → `ol.share-list` of
  `li.share-row share-row--N` (N = the slice rank; none for a row in `Ostatní`): line 1 `span.key`, name, Amount;
  line 2 `span.share-row__indent`, `span.bar > span.bar__fill` with `style="--share: <percent>"`,
  `span.share-row__shares`. The category-less row is `data-layer="Share row / Without category"` with
  `share-row__name--none`.
- Tokens used: --color-chart-track, --color-chart-series-1 … --color-chart-series-5, --color-chart-other,
  --size-bar, --size-key, --size-amount, --size-shares, --radius-full, --space-2 … --space-5, --font-size-caption
- Platform notes: two lines per row at every width. The `--share` custom property is data, not a token. Names
  truncate with an ellipsis (category names reach 100 characters).
