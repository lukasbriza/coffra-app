# Report — dashboard (web)

Screen: `apps/coffra-web/design/screens/dashboard.html` · Brief: `apps/coffra-web/design/brief.md` → Dashboard ·
Direction: `design/DESIGN.md` (B — Verdict band, accepted by the requester; replaces A — Statement).
Date: 2026-11-21.

## Revisions

| # | What | Why |
|---|---|---|
| 1 | Direction B built (rings, band, cards) | the requester rejected A on the built screen |
| 2 | Band-to-page fade instead of a hard bottom edge; the sidebar joins the band; "Zůstatek" → "Rozdíl" | requester's review of B: the cut from dark to light looked unnatural; "Zůstatek" means an account balance |
| 3 | The sidebar back to revision 1: solid white over the full height, `accent.soft` pill for the current item, email + Nastavení at its foot; the fade stays in the content column only | requester: the sidebar must not take part in the band or the fade; the hard vertical edge between sidebar and band is accepted |
| 4 | The fade removed: solid band ending on a straight edge, light page below, as in revision 1; `size.fade` removed | requester: with the fade only in the content column, the white sidebar blended into the light page at the bottom |

The screen as it stands (revision 4): revision 1's layout — solid band ending on a straight edge, light page below,
white full-height sidebar with the `accent.soft` pill — plus what revisions 2–3 added and the requester kept:

- "Rozdíl" for the period's net: under the net (`Rozdíl za 6 měsíců, 1. 6. – 30. 11. 2026`), in the trend legend
  and in the trend's accessible label ("Zůstatek" means an account balance).
- The page is a grid: the sidebar spans the full height, the content column has the band row and the detail row. At
  ≤ 1024 the rows are `auto auto 1fr auto` (top bar, band, content, tab bar), so a viewport taller than the page never
  stretches the bars.
- Rings stay rings; slice colours stay by rank.
- The band-to-page gradient (revisions 2–3, token `size.fade`) is gone, and so is the token. `color.accent.soft`
  (`#e6e7fc`) is in place, as in revision 1.
- "Rozdíl" under the net (`Rozdíl za 6 měsíců, 1. 6. – 30. 11. 2026`), in the trend legend and in the trend's
  accessible label. No other place named the net.
- Rings stay rings; slice colours stay by rank.

## Gate result

| Check | Command | Result |
|---|---|---|
| Deterministic detector (incl. WCAG AA contrast) | `pnpm dlx impeccable detect <screen> --json` (impeccable 4.10.0) | exit `0`; one **advisory** finding (`flat-type-hierarchy`), accepted — see below |
| Brand / generic score | `pnpm dlx designlang verify-ui localhost:4321/dashboard.html --brand <brand file>` (designlang 13.4.1) | PASS — on brand 99/100, generic look 0/100, no drift (390, 768, 1280) |
| Categorical palette of the rings | dataviz `validate_palette.js --mode dark --surface #1d2030` | 5 slots PASS on lightness band, chroma, CVD separation (worst adjacent ΔE 13.2), normal-vision floor (19.3), contrast ≥ 3 : 1. `Ostatní` (`#a3a7b8`) fails only the chroma floor, on purpose: it is the neutral; its CVD distance to slice 5 is 10.6 |
| Token discipline | script over the `<style>` block | no hex or px outside `:root` except the two media-query widths; every custom property defined is used and every one used is defined; all 81 token values equal `design/tokens/*.json` (the font family is in `DESIGN.md`, not the package) |
| Requester's constraints | screenshots and measured positions | all met — see the table |

Fix rounds in revision 4: 0 — the detector, the brand check and the screenshots were clean on the first run. Fix
rounds in revision 2: 1. At ≤ 1024 the page grid had a single implicit `auto` row track, so when the viewport was
taller than the page the extra height was spread over every row and the top bar grew. → explicit rows
`auto auto 1fr auto` (top bar, band, content, tab bar). Revision 1 used its two rounds on share-bar tracks and ring
legends (unchanged since).

Findings accepted on purpose:

- `flat-type-hierarchy` (advisory, does not fail the gate): "h3 14px, body 16px, h2 18px". The detector reads the
  card headings, including the ring-card `h3` at its 600-and-below size. The hierarchy of this screen is carried by
  the net (`display`, 64 px), the page title (28 px) and the rings, not by card headings; card headings sit one step
  above body and are separated from it by weight (700 vs 400). Raising them would cost the 390 fold the vertical room
  it has (4 px to spare).

### How the brand check was run

`--brand design/DESIGN.md`, the documented command, still fails: designlang reads the brand from YAML front matter
(`colors.primary` …) and the `DESIGN.md` skeleton has none (`No primary colour found`). It was run against a brand
file derived from the tokens: primary `#4b4ee8` (`color.accent.primary`), secondary `#14161f` (`color.text.primary`),
the `bg`, `band` and `amount` colours, font Urbanist, radii 4 / 12 / 24 / 999, spacing base 4.

## Screenshots

In `apps/coffra-web/design/reports/dashboard/` (gitignored, regenerable):

| File | What |
|---|---|
| `dashboard-1440.png` | 1440 × 1400, the width that goes to Figma |
| `dashboard-1440-fold.png` | 1440 × 900 — the fold on a single desktop monitor |
| `dashboard-1100.png` | 1100 × 1500 — sidebar still on, legends under the rings |
| `dashboard-768.png` | 768 × 1900 — top bar, tab bar, Sum as one row |
| `dashboard-390-true.png` | a real 390-wide viewport, whole page |
| `dashboard-390-fold.png` | a real 390 × 664 viewport — the visible area of a phone browser |
| `dashboard-390.png` | shoot.mjs output from revision 1 — **not a 390 layout**, see below |

`shoot.mjs` cannot render 390 on this machine: headless Chrome on Windows clamps the window to 500 px. The
`390-true` / `390-fold` shots were taken through a 390 px `<iframe>` inside a 500 px window, so the page's media
queries see 390. Positions at 390 × 664 were measured in the same frame after revision 4: top bar 0–52, controls
60–104, verdict 120–286, rings 302–590, tab bar from 594 (measured with a 15 px scrollbar, the worse case).

## Fold check (revision 4)

| Viewport | Above the fold | Measured |
|---|---|---|
| 1440 × 900 | verdict, net, Sum, both rings with legends | ring cards end at ≈ 626, band at ≈ 666 — unchanged |
| 1100 × 900 | the same, legends under the rings | ring cards end at ≈ 865 |
| 768 | the same; the Sum is one row | ring cards end at ≈ 918 (no fold requirement between the two measured sizes) |
| 390 × 664 | verdict, net, three Sum figures, both rings with legends | rings end at 590, tab bar from 594 — unchanged |

## Requester's constraints

| Constraint | How the screen meets it |
|---|---|
| Key question answered without scrolling, phone and desktop | see the fold check. The largest expense category is in the expense ring's centre (`65,8 % Bydlení`). |
| Opens with two pie charts, expense and income by category | the two ring cards are the band's second row, directly under the verdict, above any list or trend. |
| At most five categories plus "Ostatní" | expense ring: five slices + `Ostatní (2)` (Zdraví + Bez kategorie, 2 340,00 Kč); income ring: one slice (Mzda). Hues validated as a set. |
| Every number shows its period and currency | every amount carries `Kč`; the Sum labels say `za 6 měsíců`; ring titles `Výdaje/Příjmy za 6 měsíců`; the trend axis is in `Kč` with month names, caption `červen – listopad 2026, CZK za měsíc`; both lists' captions `za 6 měsíců, CZK`; `Rozdíl za 6 měsíců, 1. 6. – 30. 11. 2026` under the net. |
| Add transaction always visible | labelled pill `Přidat transakci` in the band's header (> 1024) and in the sticky top bar (≤ 1024); never in a menu. |
| Every screen one click from navigation | sidebar (> 1024) and tab bar (≤ 1024) list Přehled, Transakce, Účty, Kategorie, Nastavení at the top level. |
| Row actions on their row | not applicable: the dashboard's rows are aggregates with no edit or delete. |
| Phone and desktop equal weight | designed and measured at 1440 and a real 390; 1100 and 768 checked for the in-between. |
| Mobile is the responsive web | one responsive file, no native drawing. |
| Light mode with one dark hero band, one token set | one dark band at the top carrying the headline figure and both charts, ending on a straight edge; everything below it is light. One `color` set, no dark mode. |
| Look per the references | net at 64 px with `Kč` at 24 px beside it; cards with `radius.lg` (24) separated by space, no rules anywhere; figures in Urbanist (no monospace); segmented controls, segments, buttons and navigation items fully rounded; every icon on a tile; trend drawn as smooth filled areas; one accent (indigo); green only on the net and the trend's gain area. |
| No avatars, photos, 3D, floating icons, glassmorphism | none; no `backdrop-filter`, no blur, no images. |
| One currency at a time | currency switch `CZK` (selected) / `EUR`; every figure on the page is CZK; nothing summed or converted. |
| No panels for data the contract cannot return | every figure is a field of `GET /api/dashboard` or a ratio of two; the trend note is the seed's own planned payment; the sidebar keeps empty room for later modules without designing them. |

## Notes for the import

- Layout is flex and grid only. The page itself is a grid (`nav band` / `nav content`); expect the importer to
  place the sidebar, the band and the content as three frames, each with Auto Layout inside. `position: sticky` exists only at ≤ 1024, so it never
  reaches the 1440 import. The ring centre shares a grid cell with the ring.
- Charts are inline SVG. Slice and area colours are set by CSS classes (token custom properties), not by SVG
  attributes: check after import that the ring slices and the trend areas kept their fills; if the importer
  serialises the SVG without computed styles, they arrive black and need binding to the `chart.*` variables.
- The share bars' widths come from the inline `--share` custom property (data). Figma receives the computed widths.
- Font: Urbanist (Google Fonts) — in Figma's catalogue.
