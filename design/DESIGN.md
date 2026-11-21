# Design — Coffra

Figma file: <link, filled in after the first hand-off>
Plan: `docs/00_plan.md`   Issue: <url>

## Purpose

A personal overview of income and expenses across all of one's accounts, judged by the requester as
its daily user: the dashboard answers whether they earn more than they spend and where they spend for
no reason. It is also a portfolio piece. The MVP is the first step towards one app that adds
investments, their costs and progress towards a self-defined financial-freedom number, so navigation
and the dashboard must leave room for those modules without designing them now.

## Requester's constraints

What the requester ruled out or required. **Binding**: a violated constraint is a phase 3 finding,
and only the requester can remove one.

- The answer to the dashboard's key question is visible without scrolling, on a phone and on a
  desktop — rules out a summary pushed below a header, filters or a chart that does not itself
  answer it.
- The dashboard opens with two pie charts: expense by category and income by category — rules out
  leading with a table, a trend line or a lone figure.
- A pie shows at most the five largest categories plus "Ostatní" — rules out a slice per category
  without bound, and colours that stop being distinguishable.
- Every number shows its period and currency — rules out bare figures whose context is only in a
  heading elsewhere on the page.
- The primary action (add a transaction) is always visible — rules out hiding it in a `⋯`
  overflow menu, a hover-only control or a second-level page.
- Every screen is one click from the navigation — rules out nested sub-pages and settings buried
  behind other screens.
- Row actions (edit, delete) sit on the row they act on — rules out a detached toolbar or actions
  elsewhere on the page.
- Phone and a single desktop monitor carry equal weight, used 1–2× a week each — rules out a
  desktop-only layout with a squeezed mobile fallback, and layouts that need two monitors.
- Mobile is the responsive web in a phone browser — rules out a native app in the MVP.
- Light mode with one dark hero band — the band at the top carries the headline figure and the
  dashboard's charts, light surfaces below it; one token set. Rules out a fully dark theme, a
  user-switchable dark mode and a second token set in the MVP.
- The look follows the requester's references (`design/references/`, local only): the headline
  amount at display size with the currency smaller beside it; content in cards with large radii,
  separated by space rather than hairlines; figures in the same geometric sans as the text, no
  monospace; segmented controls and buttons fully rounded; icons sit on a round or rounded tile;
  charts drawn smooth and filled; one strong accent colour, with green and red only for the sign
  of an amount. Rules out hairline-ruled tables as the main structure and near-monochrome pages.
- No avatars, photographs, 3D objects, floating decorative icons or glassmorphism (translucent
  blurred layers) — the app has no images to show and text contrast on blur is unreliable.
- One currency at a time — a currency switch picks which currency the dashboard shows, and every
  figure on it belongs to that currency alone; rules out summing or converting across currencies
  and showing several currencies side by side.
- Investments, financial freedom and user-defined metrics are out of the MVP's contract — rules
  out designing screens or panels for data the API cannot return.

## Idea

The period's answer is the first thing on the page: a dark band carries the net at display size and, beside it, where
the money went and where it came from as two rings of at most six slices; everything below the band is the detail
behind those figures, in cards.

## Direction

**B — Verdict band.** Dealt in a direction revision from three candidates (below), after the requester rejected A on
the built screen. The requester's constraints fix the band, the two rings and the look, so the candidates differ in
what the band leads with and in how the detail below it is shown.

| Axis | Choice |
|---|---|
| What carries hierarchy | size, then position: the net (`display`, 64) is the largest figure, top left of the band; the two rings are the largest shapes, directly under it; the income / expense / "Lze investovat" card beside the net is subordinate (`heading`), and the light detail below is smaller again |
| Density | comfortable, read-first: one answer and two rings above the fold, every category and every month one scroll below |
| How records are shown | cards: the rings and the sum on band cards; below, a month trend card and two ranked category lists (expense, income), each row two lines with a share bar — space between rows, no rules |
| Colour's job | neutral chrome plus one accent (indigo: the add action, the current navigation item, focus); five categorical hues plus a neutral only in the rings, their legends and the category keys; green and red only for the sign of an amount — the net, and the gap between income and expense in the trend |
| Type | one family, Urbanist (geometric sans), four weights; figures in the same family with tabular numerals; the currency beside the display figure set smaller |
| Edges | tone, radius and space: band cards on the dark band, white cards on the light page, `radius.lg`; no hairlines, no shadows. The band ends on a straight edge and the light page starts below it; the white sidebar meets the band on a straight vertical edge |

How it meets the requester's constraints, where it is not obvious:

- Above the fold at 1440 × 900 the band ends at y ≈ 666 with the verdict, the net, income, expense, "Lze investovat"
  and both rings with their legends. At a real 390 × 664 the band's last card ends at y = 590, above the tab bar
  (y = 594): the verdict, the net, the three sum figures and both rings with their legends.
- The rings are pies with the centre cut out, so the largest category's share and name sit in the middle: the second
  half of the key question is answered inside the chart itself.
- Each ring shows the five largest categories of its side plus `Ostatní (n)`. The five hues are fixed by rank and
  validated as a set on the band card surface (lightness band, chroma, colour-blind separation, contrast ≥ 3 : 1);
  `Ostatní` is a neutral that differs from slice 5 by lightness. Legend text is in text tokens, never in the slice
  colour.
- Every figure carries `Kč` and its period: the sum labels say `za 6 měsíců`, each ring's title says
  `Výdaje/Příjmy za 6 měsíců`, the trend's axis is in `Kč` with the months on it, each list's caption names the period.
  The window (`1. 6. – 30. 11. 2026`) is under the net.
- The add action is a labelled pill: in the band's header above 1024, in the sticky top bar at 1024 and below.
- The period's net is called **Rozdíl** (income − expense), never "Zůstatek", which in Czech means an account
  balance: `Rozdíl za 6 měsíců, 1. 6. – 30. 11. 2026` under the net, `Rozdíl` in the trend legend.
- Band edges: the band is solid `band.bg` and ends on a straight edge; the light page (`bg.page`) starts below it.
  The sidebar is a solid `bg.surface` column over the full height and meets the band on a straight vertical edge.
  A band-to-page gradient was tried twice and rejected by the requester: first with the sidebar's top on the band and
  its foot in the fade (the sidebar lost its own surface), then with the fade in the content column only (the white
  sidebar blended into the light end of the fade at the bottom).
- The currency switch (`CZK` | `EUR`) and the period control (`3 měsíce` | `6 měsíců` | `1 rok`) are the same
  segmented control, side by side in the band's header. Every figure on the page belongs to the selected currency.

### Rejected

- **A — Statement.** Income − expense = net written out as a sum, every category and every month as hairline-ruled
  tables, IBM Plex Mono for figures, near-monochrome ink on warm paper. Built, and rejected by the requester on the
  screen: they wanted the two pie charts first and a card-based look per their references, not hairline tables,
  monospace figures and a near-monochrome page.
- **C — Category cards.** The band as in B; below it, each category as its own card (tile in its slice colour, amount,
  share of expense and of income). Rejected: a grid of equal cards is the generic dashboard look, the number of cards
  is unbounded (categories are user-made, ADR 0014), the categorical colour spreads over the whole page and competes
  with the accent, and the contract has no per-category monthly series to make a card more than a row.
- **D — Month-led.** The band as in B; below it, the period as one card per month (income, expense, net, a small
  ring). Rejected: the key question is about the period, not a month; twelve equal cards at `1 rok` need horizontal
  scrolling at 390; and a small ring per month repeats the band's rings at a size where six slices cannot be read.

## Shared across platforms

- Palette and colour semantics (`color` export):
  - light surfaces — `bg.page` behind everything, `bg.surface` for cards, the sidebar and the tab bar, `bg.sunken`
    for a recessed note; `text.primary` for names and figures, `text.secondary` for labels, periods and units.
  - the band — `band.bg` behind it (and behind the top bar at 1024 and below), `band.surface` for its cards,
    `band.track` for a segmented control's track and an icon tile, `band.selected` + `band.text.onSelected` for the
    selected segment, `band.text.primary` / `band.text.secondary`, `band.amount.positive` / `.negative` for the sign
    of the net on it.
  - `accent.primary` only for the primary action, the current navigation item's tile and the focus ring;
    `accent.soft` behind the current item in the sidebar; `text.onAccent` on the accent.
  - `amount.positive` / `amount.negative` only for the sign of an amount on a light surface (never for income or
    expense as such).
  - `chart.series1` … `series5` the five largest categories of a ring in rank order, `chart.other` for `Ostatní` and
    the categories folded into it; the same colour keys a category in the lists below. `chart.income` /
    `chart.expense` the trend's lines, `chart.expenseArea` under the expense line, `chart.gainArea` /
    `chart.lossArea` the gap between income and expense in a month whose net is positive / negative, `chart.grid`
    the trend's grid, `chart.track` behind a share bar.
- Motion intent: none on the dashboard. A change of period or currency swaps the figures and redraws the charts in
  place; nothing animates to draw attention to a number.
- Radii and elevation as roles: `radius.full` on every button, segmented control, segment, navigation item and share
  bar; `radius.lg` on cards (band and light); `radius.md` on icon tiles, the trend note, and the ring cards at 600 and
  below; `radius.sm` on colour keys. No elevation and no hairlines: separation is tone and space.
- Component vocabulary: `design/components.md`.

## Web

- Type scale (`fontSize` / `lineHeight`, px in the tokens, rem = px / 16 in the implementation): caption 13/18,
  label 14/20, body 16/24, heading 18/24, figure 24/32, title 28/36, displayNarrow 40/44, display 64/68.
  `letterSpacing.tight` (−1.5 px) on display, `snug` (−0.4 px) on title, figures and displayNarrow, `normal`
  elsewhere. Weights: regular 400, medium 500 (navigation, secondary names), semibold 600 (labels, legend shares, list
  names), bold 700 (figures, headings, the current navigation item). Numerals tabular
  (`font-variant-numeric: tabular-nums`).
- Background: the page `bg.page`; the sidebar `bg.surface`; the band (and the top bar at ≤ 1024) solid `band.bg`. No
  gradients.
- Spacing unit and density: the 4 px grid, `--space-1` … `--space-12`. Every control is at least 40 px high above
  1024 (`size.control`) and 44 px at 1024 and below (`size.touch`).
- Layout: authored at 1440 — the page is a grid: the sidebar column `size.sidebar` (248) spanning the full height,
  and the content column (up to `size.content`, 1200, padded 40) with two rows, the band (solid `band.bg`) and the
  detail (on `bg.page`). The
  band: header (title + window | currency switch, period control, add action), then the verdict (net left, sum card
  right, wrapping under it when they do not fit), then the two ring cards side by side. A ring's legend sits beside it
  while the legend gets at least two thirds of `size.column`, otherwise under it. Below the band a 7 : 5 grid: month
  trend and income list left, expense list right (at least `size.column`). At ≤ 1024 (`breakpoint.compact`) the
  sidebar becomes a dark top bar (wordmark + add action) and a bottom tab bar, the sum card turns into one row of
  three, legends go under the rings and the detail becomes one column. At ≤ 600 (`breakpoint.narrow`) the page title
  is dropped (the tab bar names the screen), the net uses `displayNarrow`, the sum becomes three plain figures without
  tiles, the rings shrink to `size.ringNarrow` and their legends keep only the shares (the amounts are in the lists
  below).
- Navigation pattern: wide — a white sidebar over the full height with the wordmark, the money screens (Přehled,
  Transakce, Účty, Kategorie) as one group with icons, the current item an `accent.soft` pill with its icon on an
  `accent.primary` tile, empty room under the group where later modules add their own group, then the signed-in
  email and Nastavení at its foot. Narrow — a tab bar with the same five items, always visible. Five tabs
  is the limit of a 390 tab bar: the first module beyond them needs a navigation decision on narrow screens.
- Fonts: Urbanist 400/500/600/700 (Google Fonts, so Figma has it; Czech diacritics included). Fallback stack:
  `"Urbanist", "Segoe UI", system-ui, sans-serif`, in the screen files as `--font-family-text`. No second family.

## Native

No native app in the MVP (requester's constraint: mobile is the responsive web). Nothing designed; when a native
app lands, it shares `color`, `radius` and `borderWidth`, and gets its own unitless type scale and a spacing that
clears a 44 pt target.

- Type scale: —
- Spacing and minimum touch target: —
- Layout constraints: no CSS grid, no hover
- Navigation pattern: —
- Fonts: —

## Token structure

Tokens package `packages/tokens` (`@lukasbriza/tokens`), mapped by `design/tokens.config.json`; one Figma
collection per set.

| Set | Exports | CSS custom properties |
|---|---|---|
| `color` | `color` (`bg`, `text`, `accent`, `amount`, `band`, `chart`) | `--color-bg-page`, `--color-band-text-primary`, `--color-chart-series-1`, … |
| `spacing` | `spacing` (as `space`, 12 steps), `radius`, `borderWidth`, `size` | `--space-1` … `--space-12`, `--radius-full`, `--border-width-line`, `--size-ring`, … |
| `typography` | `fontSize`, `lineHeight`, `letterSpacing`, `fontWeight` | `--font-size-display`, `--line-height-display`, `--letter-spacing-tight`, `--font-weight-bold`, … |

A CSS name is the token path in kebab case (`chart.series1` → `--color-chart-series-1`). Not mapped to Figma:
`breakpoint` (media queries, not a variable), and the template's `palette` / `mono` / `state` / `black` / `white` /
`gray`, kept only because `@lukasbriza/theme` and the mobile template still read them. The font family lives here, in
the Web section, not in the package.

## Figma

- File: <link>, worked in drafts
- Collections: `color`, `spacing`, `typography` — one per token set
- Pages: system / screens / spare
