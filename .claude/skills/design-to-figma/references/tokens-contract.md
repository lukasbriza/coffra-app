# Phase 1 + 4 — the token contract

The tokens package is the single source of truth for every design value in the repo:

```
packages/<tokens>  ──┬──► design/tokens/*.json  ──► Figma variables   (Tokens Studio)
    (TypeScript)     ├──► the web theme
                     └──► the native theme
```

Two consequences, and both are the point of this file:

- A colour, radius or size that exists only in a screen's CSS is a bug. Add it to the tokens
  package first, then reference it.
- Figma variables are **generated**, never hand-edited. Editing a variable in Figma desyncs it
  from the code and nothing will tell you.

## The token set is per repo

`templates/package-tokens` is a **starting example**, not a schema. A project shapes its tokens
to fit its own application, and this skill does not impose a universal set. There is no minimum
palette to conform to and no required naming.

What that means in phase 1:

- **Derive the set from the brief.** The screens state how many text levels they need, how many
  surfaces stack, which states appear, how dense the spacing has to be. A dashboard with tables
  needs border and surface roles that a landing page does not.
- **Missing package?** Scaffold it from the template (`pnpm turbo gen package-tokens`), then
  reshape it. Keep what fits, rename what does not, delete what the app will never use.
- **Keep it framework-free and values-only.** That constraint is real — it is what lets both a
  web and a native theme consume it. Read the package's own `CLAUDE.md` before adding anything.
- **Record the structure in `design/DESIGN.md`.** That record is the per-repo contract later
  screens conform to. Without it, screen four invents a fifth grey.

The one universal rule: **a screen contains no value that is not a token.** The set is yours; the
discipline is not optional. That is what phase 3 checks.

## Mapping tokens to DTCG

Because the set is per repo, the generator is config-driven. `design/tokens.config.json` maps
your exports onto DTCG files:

```json
{
  "entry": "packages/tokens/dist/index.js",
  "sets": {
    "color": [{ "export": "palette", "type": "color" }],
    "spacing": [
      { "export": "spacing", "type": "dimension", "as": "space", "steps": 12 },
      { "export": "radius", "type": "dimension" }
    ],
    "typography": [
      { "export": "fontSize", "type": "dimension" },
      { "export": "fontWeight", "type": "fontWeight" }
    ]
  }
}
```

| Key | Meaning |
|---|---|
| `entry` | the built tokens module, relative to the repo root. **Set it explicitly:** a project scaffolded from this template usually renamed its packages to avoid workspace-name collisions, so `packages/tokens` is often `packages/<project>-tokens` |
| `sets` | one key per output file, and therefore one per Figma variable collection |
| `export` | the named export to read |
| `type` | DTCG leaf type: `color`, `dimension`, `number`, `fontWeight`, `fontFamily`, `duration` |
| `as` | group name in the output; defaults to the export name |
| `steps` | the export is a function — materialise `1..steps` |

Nested objects become nested DTCG groups, so `color.bg.surface` survives as a path. Pick `as`
deliberately: an export already named `color` inside a set named `color` yields `color.color.bg`.

With no config file the generator falls back to the shape the template ships, so a freshly
scaffolded package works untouched. Reshape your tokens and the generator fails loudly, naming
the missing export and listing what the module actually exports — adjust the config, never the
script. The script lives in `.claude/` which the template owns, and `sync-template` will
overwrite it.

## Generating

```bash
pnpm --filter <tokens package> build
node .claude/skills/design-to-figma/scripts/tokens-to-dtcg.mjs
```

Run from the repo root. `design/tokens/` and `design/DESIGN.md` are repo-wide, because the tokens
package is shared; only the brief, the components vocabulary, the screens and the reports are
scoped to a workspace.

Font families deliberately live per platform (web via CSS, native via `expo-font`), so record the
chosen family, weights and fallback stack in `design/DESIGN.md`, not in the package.

## Importing into Figma

Tokens Studio on a free licence attaches tokens to Styles and Variables by exporting **from Token
Sets** (the Themes route is Pro). It creates **one variable collection per exported token set**,
local to the current file — which is why the generator writes one file per set.

1. Open the Figma draft file, launch Tokens Studio.
2. Import the files from `design/tokens/` as token sets.
3. Styles & Variables → Export to Figma → from Token Sets → select them all.
4. Confirm one collection appears per set.

Re-run and re-export after any token change. Do not merge collections.

## A second platform

Do not split the tokens before a second consumer exists — that is guessing at how they will
differ. When a native app lands, the split is about an hour and the generator needs no change,
because it takes any set you declare.

Three layers, and the package's own `CLAUDE.md` already assumes this shape: colours shared,
scales as a mobile baseline with the web theme keeping its own rem scale.

| Layer | Holds | Shared? |
|---|---|---|
| core | palette, colour semantics, motion durations, radii as roles | yes |
| web | rem type scale, web spacing unit and density | no |
| native | unitless type scale, spacing that clears a 44pt touch target | no |

In the config that is just more sets:

```json
{
  "sets": {
    "color":             [{ "export": "palette", "type": "color" }],
    "motion":            [{ "export": "duration", "type": "duration" }],
    "typography-web":    [{ "export": "webFontSize", "type": "dimension" }],
    "typography-native": [{ "export": "nativeFontSize", "type": "dimension" }],
    "spacing-web":       [{ "export": "webSpace", "type": "dimension", "as": "space", "steps": 12 }],
    "spacing-native":    [{ "export": "nativeSpace", "type": "dimension", "as": "space", "steps": 12 }]
  }
}
```

One set per Figma collection, so the platforms stay separable on a Starter plan that has no
modes. Anything that *could* be shared belongs in core: a value that differs per platform is a
decision, and it needs its reason in `design/DESIGN.md`.

## Light and dark on a Starter plan

Starter gives **one mode per collection**, so a light/dark pair cannot be two modes. Two options,
in order of preference:

1. **One theme only.** Pick the one that matters and design it properly. A second theme is a real
   design job, not a token flip, and it doubles every review.
2. **Two sets.** Emit `color-light` and `color-dark` as separate sets in the config; they become
   two collections. Switching means rebinding, so this only pays off if both are in scope.

Never fake it by duplicating the file and editing values in Figma.

## Naming in the screens

CSS custom property names must match the token path, because that correspondence is what makes
the variable binding in phase 4 mechanical rather than guesswork.

| Token path | CSS custom property |
|---|---|
| `color.bg.surface` | `--color-bg-surface` |
| `color.state.error.primary` | `--color-state-error-primary` |
| `spacing.space.4` | `--space-4` |
| `spacing.radius.md` | `--radius-md` |
| `typography.fontSize.body` | `--font-size-body` |

Lowercase, hyphen-separated, dots become hyphens. No ad-hoc aliases: a property named
`--card-bg` hides which token it came from, and phase 3 cannot tell it from a hardcoded value.
