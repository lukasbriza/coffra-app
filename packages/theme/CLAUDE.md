# CLAUDE.md — theme package (@lukasbriza/coffra-theme)

The MUI theme of the Coffra design. Inherits monorepo conventions from the root `CLAUDE.md`.

## Stack

- MUI v9 (`@mui/material`, `@mui/system`, `@mui/types`), React 19.
- Built as a library (`tsc --build tsconfig.build.json` → `dist/`), consumed by apps via `workspace:*`.
- Depends on **`@lukasbriza/coffra-tokens`** (`workspace:*`), the framework-free design tokens. Tokens must exist
  first (generator order).
- Tests: vitest (`pnpm test`, `test/*.spec.ts`, node environment).

## The rule: values come from the tokens

The theme is the MUI composition of `@lukasbriza/coffra-tokens`, not a second copy of its values. No hex colour, size
or font size is written in `src/` (`test/source.spec.ts` fails on a bare hex). A new design value goes into the
tokens first, then the theme maps it. What each role means: `design/DESIGN.md`.

| Theme                                                           | Token                                                                            |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `palette.mode`                                                  | `'light'`                                                                        |
| `palette.primary.main` / `.contrastText`                        | `color.accent.primary` / `color.text.onAccent`                                   |
| `palette.background.default` / `.paper` / `.sunken`             | `color.bg.page` / `.surface` / `.sunken`                                         |
| `palette.text.primary` / `.secondary` / `.onAccent`             | `color.text.primary` / `.secondary` / `.onAccent`                                |
| `palette.accent`, `.amount`, `.band`, `.chart`                  | `color.accent`, `.amount`, `.band`, `.chart` (same keys)                         |
| `typography.<variant>`                                          | `fontSize`, `lineHeight` (in `rem`, px / 16), `letterSpacing` (px), `fontWeight` |
| `typography.fontWeightRegular` / `Medium` / `Semibold` / `Bold` | `fontWeight.regular` / `medium` / `semibold` / `bold`                            |
| `shape.sm` / `md` / `lg` / `full` (`borderRadius` = `md`)       | `radius`                                                                         |
| `spacing(n)`                                                    | `spacing(n)` (4 px grid)                                                         |
| `size.*`                                                        | `size`                                                                           |
| `borderWidth.*`                                                 | `borderWidth`                                                                    |
| `breakpoints.values.narrow` / `.compact`                        | `breakpoint.narrow` / `.compact`                                                 |

`palette.primary.light`/`.dark` are derived by MUI; the design has no such roles. MUI's other defaults (`secondary`,
`error`, shadows, transitions) stay as they are and are not part of the design.

## Typography

- Font stack `FONT_FAMILY`: `var(--font-urbanist, "Urbanist"), "Segoe UI", system-ui, sans-serif`. The app loads
  Urbanist and sets `--font-urbanist` (`FONT_FAMILY_VARIABLE`); without it the stack asks for a font named Urbanist.
- Variants of the design: `caption`, `label`, `body`, `heading`, `figure`, `title`, `displayNarrow`, `display`.
  Each has the default weight and letter spacing of `design/DESIGN.md` → Web; a component sets another weight from
  `theme.typography.fontWeight*` where the design asks for it.
- MUI's built-in variants (`h1`–`h6`, `subtitle1/2`, `body1/2`, `button`, `overline`) are off in the theme and in the
  types. `caption` is MUI's own name with the design's values. The template's `S/M/L/XL` are gone.
- `<Typography>` renders `title` as `h1`, `heading` as `h2`, `body` as `p`, the rest as `span`; pass `component`
  for anything else.

## Breakpoints

- Keys `xs` (0), `narrow` (600), `compact` (1024). MUI's `sm`, `md`, `lg`, `xl` are off, so MUI components that read
  them (`Toolbar`, `Dialog` `fullScreen`, `Container maxWidth="sm"`) don't fit this theme.
- The design's media queries include the edge (`≤ 1024`, `≤ 600`). Use `atMost('compact')` /
  `theme.breakpoints.atMost('narrow')` (`@media (max-width: 1024px)`), not MUI's `down()`, which stops at
  `1023.95px`.

## Baseline

`ThemeProvider` renders `CssBaseline`: the page background `bg.page`, the body text in the `body` variant with tabular
numerals, and the focus ring (`borderWidth.focus` solid `accent.primary`, offset by the same width) on
`:focus-visible`.

## Layout (src)

- `palette.ts`, `typography.ts`, `breakpoints.ts` — the MUI options built from the tokens; `atMost` lives in
  `breakpoints.ts`.
- `components.ts` — `MuiCssBaseline` (baseline above) and `MuiTypography` (`variantMapping`).
- `constants.ts` — `HTML_FONT_SIZE`, `FONT_FAMILY_VARIABLE`, `FONT_FAMILY`, `DISABLED_VARIANTS`.
- `web-theme.ts` — `webTheme` (`createTheme`). **No `'use client'`**, so a server component can read its values.
- `theme-provider.tsx` — `'use client'`: `ThemeProvider` (+ `CssBaseline`) and `useTheme`.
- `types.ts` — types derived from the tokens (`Widened<T>`, `WebPalette`, `WebShape`, `WebSize`, ...) **and** the MUI
  module augmentation.
- `index.ts` — public API: `webTheme`, `ThemeProvider`, `useTheme`, `atMost`, `FONT_FAMILY`,
  `FONT_FAMILY_VARIABLE` and the types.
- Storybook pages (palette, typography, overview) live in `stories/` and read the theme, not their own copy of the
  values. The Storybook host is `apps/storybook`.

## Conventions

- Keep the public API in `index.ts`; don't deep-import internals from consumers.
- Components style through `styled` from `@lukasbriza/coffra-styles` and read values from the theme
  (`theme.palette.band.bg`, `theme.shape.lg`, `theme.size.ring`, `theme.spacing(4)`), never a bare value.
- Consuming Next apps must add `@lukasbriza/coffra-theme` to `next.config.mjs` `transpilePackages`.

## Don't touch

- Generated: `dist/`. This package was scaffolded from `templates/package-theme`; the template keeps its own generic
  theme.
