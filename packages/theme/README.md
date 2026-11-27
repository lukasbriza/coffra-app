# @lukasbriza/coffra-theme

The MUI theme of the Coffra design: a light page with one dark band, the Urbanist type scale, radii, spacing, sizes
and breakpoints. Every value comes from `@lukasbriza/coffra-tokens`; `design/DESIGN.md` says what each role is for.

## Usage

```tsx
import { ThemeProvider } from '@lukasbriza/coffra-theme'

const App = () => <ThemeProvider>{/* app */}</ThemeProvider>
```

`ThemeProvider` also renders `CssBaseline` (page background, body text with tabular numerals, focus ring).

Style components with `styled` from `@lukasbriza/coffra-styles` and take values from the theme:

```tsx
const Band = styled('section')(({ theme }) => ({
  background: theme.palette.band.bg,
  borderRadius: theme.shape.lg,
  padding: theme.spacing(10),
  [theme.breakpoints.atMost('compact')]: { padding: theme.spacing(4) },
}))
```

## What the theme carries

- `palette` — MUI roles (`primary`, `background`, `text`) and the design's groups `accent`, `amount`, `band`, `chart`.
- `typography` — variants `caption`, `label`, `body`, `heading`, `figure`, `title`, `displayNarrow`, `display`, and
  `fontWeightRegular` / `Medium` / `Semibold` / `Bold`. MUI's `h1`, `body1`, `button` and the like are off.
- `shape` — `sm`, `md`, `lg`, `full`; `spacing(n)` — the 4 px grid; `size` and `borderWidth` — the design's fixed
  sizes and stroke widths.
- `breakpoints` — `narrow` (600) and `compact` (1024); `atMost(key)` gives `@media (max-width: …px)`, inclusive of
  the edge as in the design.

## Fonts

The app loads Urbanist (400, 500, 600, 700) and sets the CSS variable `FONT_FAMILY_VARIABLE` (`--font-urbanist`) to
it, for example with `next/font`. Without the variable the font stack (`FONT_FAMILY`) asks for a font named Urbanist.

## Scripts

```sh
pnpm build   # dist/
pnpm test    # the theme against the tokens
pnpm ts      # type check, tests and stories included
pnpm lint
```
