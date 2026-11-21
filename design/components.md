# Components — shared vocabulary

Platform-free: what each component is, its states and the tokens it binds. How a platform realises it is in
`<ui>/design/components.md` (web: `apps/coffra-web/design/components.md`). A variant is a state on an existing entry,
not a new component. Direction: `design/DESIGN.md` (B — Verdict band).

## Amount

- Role: one money figure with its currency, the smallest unit every other component is built from.
- Used on: web dashboard.
- Tokens: the text family with tabular numerals; colour `text.primary` (light) or `band.text.primary` (band);
  `amount.positive` / `amount.negative` (light) and `band.amount.positive` / `band.amount.negative` (band) only on
  a net amount.
- States: plain (income, expense — no sign, no colour), net positive (`+`, positive colour), net negative (`−`,
  negative colour), net zero (no sign, primary text colour).
- Rules: always formatted by the locale with its currency (`312 000,00 Kč`); never a bare number. In a headline the
  currency is split off and set smaller beside the figure.

## Navigation

- Role: every screen of the app, one step away, plus the signed-in user.
- Used on: every web screen.
- Tokens: colour `bg.surface`, `text.secondary` for items; the current item in `text.primary`, weight `bold`, on an
  `accent.soft` pill in the sidebar (no pill in the tab bar); its icon tile `accent.primary` + `text.onAccent`;
  radius `full`; the label type role (caption in the tab bar).
- States: item default, item current.
- Rules: the money screens are one group (Přehled, Transakce, Účty, Kategorie); Nastavení is always present. A later
  module adds a group of its own; nothing is nested under another item.

## Icon tile

- Role: the round-cornered or round plate an icon sits on, so an icon never floats on its own.
- Used on: web navigation, web dashboard (the sum).
- Tokens: `size.tile`, `size.icon`; radius `md` (square tile) or `full` (round tile); colour `bg.sunken` (light),
  `band.track` (band), `accent.primary` (the current navigation item); the icon in the text colour of its context;
  stroke `borderWidth.line`.
- States: default, current (navigation only).
- Rules: one icon per tile, stroked, no fill; no category icons — the contract has none, a category is keyed by
  colour instead.

## Primary action

- Role: the one action the screen exists to start — on the money screens, adding a transaction.
- Used on: web dashboard (in the band's header or the top bar).
- Tokens: colour `accent.primary`, `text.onAccent`; radius `full`; the label type role, weight `bold`; a plus icon.
- States: default, focused (a `borderWidth.focus` ring in `accent.primary`); disabled is not used.
- Rules: always visible and labelled with its verb; never inside an overflow menu.

## Segmented control

- Role: picks one value from a short closed list — the currency of the page, the period of a summary.
- Used on: web dashboard (currency switch: the `currency` values of `currencies`; period control: `3m`, `6m`, `1y`).
- Tokens: colour `band.track` for the track, `band.selected` + `band.text.onSelected` for the selected segment,
  `band.text.secondary` for the others; radius `full` on the track and the segments; the label type role, weight
  `semibold`.
- States: segment default, segment selected.
- Rules: the segments are the values the contract offers and nothing else. The currency switch has one segment per
  currency in the response; with a single currency it still shows, so the page always says which currency it is in.

## Verdict

- Role: answers "did I earn more than I spent" — the answer in words, the net at display size, the window it covers.
- Used on: web dashboard, the band.
- Tokens: the heading role for the sentence, `display` (`displayNarrow` on a narrow screen) for the net with the
  currency in `figure` (`heading`) beside it, `band.text.secondary` for the window; Amount states for the net.
- Wording: the net is **Rozdíl** (`Rozdíl za 6 měsíců, 1. 6. – 30. 11. 2026`), never "Zůstatek" — that is an
  account balance.
- States: net positive (`Vydělali jste víc, než jste utratili`), net negative (`Utratili jste víc, než jste
  vydělali`), net zero (`Vydělali jste přesně tolik, kolik jste utratili`).
- Rules: the net is the largest figure on the screen.

## Sum

- Role: the terms behind the net — income and expense of the period — and the share of income left
  ("Lze investovat", `net ÷ income`).
- Used on: web dashboard, the band, beside the Verdict.
- Tokens: colour `band.surface`, radius `lg`; Icon tiles on `band.track`; the label role for the names,
  `band.text.secondary` captions for the period, the heading role for the figures.
- States: default; no income (the share is `—`).
- Rules: each term's label names its period; the share is a percentage with one decimal place.

## Ring chart

- Role: one side of the money (expense or income) split by category, so the largest category reads at a glance.
- Used on: web dashboard, the band — expense and income side by side.
- Tokens: colour `band.surface` card, radius `lg`; slices `chart.series1` … `series5` in rank order and
  `chart.other` for `Ostatní`, with a gap of the card colour between slices; `size.ring` (`size.ringNarrow`); the
  centre in the `figure` role (`heading` narrow) plus a caption; a legend of colour keys (`size.key`, radius `sm`) in
  band text tokens.
- States: several slices; one slice (a full ring, no `Ostatní`); with `Ostatní (n)`; empty (the side has no amount:
  the card says so and draws no ring).
- Rules: the five largest categories of the side, the rest summed into `Ostatní (n)`; the `null` category ranked like
  any other and worded `Bez kategorie`; the centre shows the largest slice's share and name; the card's title names
  the side and the period, its head carries the side's total. A slice's colour is its rank, so a change of period
  can recolour a category — the legend always names it.

## Month trend

- Role: the period month by month — income, expense and the gap between them — so a month that broke the pattern
  stands out.
- Used on: web dashboard, below the band.
- Tokens: colour `bg.surface` card, radius `lg`; `chart.income` line, `chart.expense` line over `chart.expenseArea`,
  `chart.gainArea` / `chart.lossArea` between them, `chart.grid`; stroke `borderWidth.line` (lines) and
  `borderWidth.rule` (grid); `size.trend`; caption axis labels in `Kč` and short month names; a note on
  `bg.sunken`, radius `md`.
- States: every month with a positive net (gain area only, legend `Rozdíl`); a month with a negative net (the gap in
  `chart.lossArea`); a month with zeros (drawn at zero, never left out); the current month (the note says it runs to
  the end of the month, planned payments included).
- Rules: one axis, in the page's currency; a legend for the three marks; smooth curves that never overshoot the data
  (monotone).

## Share list

- Role: every category of one side of the money with its amount and share, ranked — the detail behind a Ring chart.
- Used on: web dashboard, below the band (expense, income).
- Tokens: colour `bg.surface` card, radius `lg`; the colour key of the category's slice (`chart.other` for those in
  `Ostatní`); `chart.track` behind a bar in the slice colour, radius `full`, `size.bar`; `size.shares` for the share
  column; the body role for names and amounts, captions for shares.
- States: row default, row in `Ostatní` (neutral key), row "without category" (the `null` row, worded by the client,
  always last), row with a name long enough to truncate, empty (the side has no amount: one line saying so).
- Rules: ordered by amount, largest first, the `null` row last; rows separated by space, never by a rule. The expense
  list shows each row's share of expense and of income; the income list its share of income.
