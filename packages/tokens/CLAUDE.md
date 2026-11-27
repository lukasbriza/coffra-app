# CLAUDE.md — tokens package (@lukasbriza/coffra-tokens)

Framework-free design tokens. Inherits root `CLAUDE.md`.

## Stack

- **Pure TypeScript data** — no MUI, emotion, React, or DOM. Built as a library (`dist/`).
- Zero runtime dependencies.

## Surface (`src/index.ts`)

- `palette` (+ `mono`, `state`, `black`/`white`/`gray`) — the template's colours; not part of the Coffra design
  and read by nothing in this repo.
- `color` — the Coffra design's colour roles (`bg`, `text`, `accent`, `amount`, `band`, `chart`).
- `spacing(steps)` + `radius` + `borderWidth` — 4px grid, corner radii, stroke widths.
- `size` — fixed layout sizes; `breakpoint` — where the web layout changes.
- `fontSize` + `lineHeight` + `letterSpacing` + `fontWeight` — type scale primitives (unitless px).
- What each role means, and the Figma mapping: `design/DESIGN.md`, `design/tokens.config.json`.

## Why it exists

Single source of truth for design values. The web MUI theme (`@lukasbriza/coffra-theme`) is composed from
`color`, `radius`, `borderWidth`, `size`, `breakpoint`, `spacing` and the type scale, and writes no value of its own
(the mapping is in its `CLAUDE.md`). A future mobile theme shares `color`, `radius` and `borderWidth` and gets its own
type scale and spacing (`design/DESIGN.md` → Native).

## Rules

- **Keep it framework-free.** Never import MUI/emotion/React here — that's what makes it usable
  from both web and native bundles.
- Values only (plain consts). No theme-building logic; that's the consumers' job.

## Don't touch

- Generated: `dist/`. Edit conventions in `templates/package-tokens`.
