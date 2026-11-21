# Phase 2 + 4 — authoring HTML that imports cleanly into Figma

The importer rebuilds flex rows and columns as **native Auto Layout**, and converts fills,
linear and radial gradients, borders, corner radii, shadows and blur. Everything it cannot
map becomes a flat frame at an absolute offset. So these are not style preferences: each
rule is the difference between a layer tree a designer can edit and one they would rather
rebuild by hand.

Author for the import from the first line. Retrofitting a built page is slower than
writing it correctly once.

## Hard rules

| Rule | Why |
|---|---|
| Layout is `flex` or `grid` only | flex becomes Auto Layout; `position: absolute` becomes a pinned frame with no layout behaviour |
| One wrapper element per visual group | redundant nesting collapses into unnamed single-child frames |
| Padding and gap carry spacing, never margins on children | Auto Layout has padding and gap; it has no per-child margin |
| No `transform` for layout | the import reads computed geometry, so a translated node lands at its untranslated slot |
| Every token referenced as a CSS custom property | the property name is what gets matched to a Figma variable later |
| Fixed widths only where the design is genuinely fixed | otherwise the frame hard-codes the viewport it was rendered at |
| One screen per file, authored desktop-first at 1440 and responsive down | the import captures the rendered width, so only 1440 reaches Figma |

## What Figma cannot hold

Rendering these in the browser and importing them produces either a flattened raster or
nothing. If the design depends on one, redesign that part.

- `backdrop-filter`, and glass effects built from it
- non-trivial `clip-path`, `mask-image`
- content generated in `::before` / `::after`
- CSS filters beyond `blur` and `drop-shadow`
- `mix-blend-mode` on text
- SVG filters, `foreignObject`
- anything whose appearance depends on `:hover`, `:focus` or a media query at import time

For state variants, render each state as its own element in the document and label it.
A hover state that exists only in CSS does not survive the import.

## Fonts

A font the Figma account does not have is silently substituted, which destroys metrics and
therefore every width in the layout.

- Prefer fonts available in Figma: the Google Fonts catalogue is present by default.
- A self-hosted or licensed font must be installed locally and the Figma desktop app used.
- Record the exact family, weights and the fallback stack in `design/DESIGN.md` (repo root).
- Set `line-height` and `letter-spacing` explicitly on every text token. Browser defaults
  are relative; Figma stores absolute values.

## Responsive, and what reaches Figma

The screen file is responsive. The import is not.

- Author desktop-first at 1440. That is the width that becomes Figma frames.
- The narrower layouts are real and must work, but they are reviewed as **screenshots in the
  report** — the inspector renders 1440, 768 and 390 — not as Figma frames.
- Set the browser window to 1440 before importing. A window at some other width silently
  produces a design nobody approved.
- If a narrow layout needs to be a design in its own right rather than a reflow, it is a
  separate screen with its own file, its own brief entry and its own pass through the pipeline.

This is the deliberate trade. On a Starter plan a file holds 3 pages, so three frames per screen
stops scaling at the second screen — and the responsive truth lives in the HTML either way.

## Native screens

A native `<ui>` goes through the same pipeline, but its HTML is a **drawing surface**: it exists
to produce correct Figma frames, not to be implemented. Four consequences.

**1. Every native screen file opens with this banner.** Without it, a future agent reads the file
as implementation input and ports CSS that React Native does not have.

```html
<!--
  DRAWING SURFACE — NOT IMPLEMENTATION INPUT.
  This file exists only to produce Figma frames for a React Native screen.
  Do not port it. The implementation reads design/DESIGN.md, the tokens package
  and the Figma file. React Native has no CSS, no grid and no hover.
-->
```

**2. Authored at a fixed 390.** No media queries, no responsive reflow. One width, one frame.

**3. Stay inside what native can express**, so the frames are honest about the real screen:

| Avoid | Because |
|---|---|
| CSS grid | React Native has flex only |
| `:hover`, `:focus-visible` as design states | there is no hover on a touch screen |
| anything smaller than a 44 × 44 touch target | it cannot be tapped reliably |
| text that depends on a web font stack fallback | native loads fonts through `expo-font` |
| scroll-linked effects | a different mechanism entirely on native |

Render state variants as separate elements, as on web — pressed instead of hover.

**4. The gate reads differently.** Contrast, hierarchy and slop findings all apply and must be
fixed. Findings about the *code* — semantic HTML, markup structure, class naming — are noise on a
drawing surface. Record which ones you dismissed and why, in the report.

## Component inventory

The vocabulary lives in two files, split the way the tokens are: shared meaning, per-platform
realisation. Read both before writing markup; append to both afterwards.

**`design/components.md`** — repo-wide, platform-free. What a component *is*:

```markdown
## Metric card

- Role: one number plus its label and trend, in a row of peers
- Used on: web dashboard, web account detail, native home
- Tokens: colour `bg.surface`, radius `md`, the display type role
- States: default, loading, no-data
```

No markup, no pixel values, no platform words. If an entry cannot be written without naming a
platform, it is two components, not one.

**`<ui>/design/components.md`** — how this platform realises each shared entry:

```markdown
## Metric card

- Shared entry: design/components.md#metric-card
- Markup: `<article data-layer="Metric card">` with label, value, delta
- Tokens used: --color-bg-surface, --space-4, --radius-md, --font-size-display
- Platform notes: delta hidden under 480; on native the row wraps to two columns
```

Three rules that make them worth maintaining:

- A component on two screens of the **same platform** has identical markup and identical tokens
  on both. A variant is a state on the existing entry, not a new component.
- A component on two **platforms** shares the role, the states and the colour tokens. Its markup
  and its scales differ, and that is the whole reason for the split.
- Every shared entry becomes a Figma component in step 5 of the hand-off. An inventory nobody
  kept is why an imported file ends up as a hundred unrelated frames.

## Layer naming

Layer names come from the element, so name them in the markup. A `data-layer` attribute is
the clearest signal, and a semantic tag plus a single class is the fallback.

```html
<section data-layer="Dashboard / Summary" class="summary">
  <article data-layer="Metric card" class="metric">
    <p data-layer="Label" class="metric__label">Výdaje</p>
    <p data-layer="Value" class="metric__value">38 420 Kč</p>
  </article>
</section>
```

Name by role, not appearance: `Metric card`, not `White box`. Repeated instances share one
name — that is what makes the component promotion in step 4 obvious.

## Handoff procedure

In this order. Variables before layers, because a layer can only bind to a variable that
already exists.

1. **Tokens → variables.** `references/tokens-contract.md`. One-off per project, repeated
   only when tokens change.
2. **Screens → layers.** Set the browser window to 1440. Open the html2figma plugin in a Figma
   **draft** file and drop
   `<ui>/design/screens/<name>.html`. The plugin also accepts pasted HTML and CSS, and a `.zip`
   of a saved page folder when images are referenced relatively.
3. **Verify the import** before touching anything: frames are Auto Layout, text is editable
   text nodes, no unexpected raster images, fonts not substituted. If any of those fail, fix
   the HTML and re-import. Do not repair it in Figma.
4. **Promote** each repeated node to a component, and bind its colour, radius and spacing to
   the variables from step 1.
5. **Promote** each entry in `design/components.md` to a Figma component, and bind its colour,
   radius and spacing to the variables from step 1. With two platforms, a shared entry becomes
   one component per platform — same name, platform suffix — because the markup differs.
6. **Rename** anything the markup did not name well enough.
7. **Record the file's link** in `design/DESIGN.md`, so the design and its render stay tied.

Re-importing a changed screen creates a new frame; name it `<name> vN` rather than importing over
the old one. Figma-side edits do not survive a re-import — fix the HTML instead.

## Starter-plan constraints

| Constraint | Consequence |
|---|---|
| 3 team files, 3 pages each; drafts unlimited | work in a draft; one file holds the whole system |
| No published libraries | components are file-local — do not split the system across files |
| One mode per variable collection | light and dark are two collections, not two modes |
| No Dev Mode | the Figma-to-code direction is unavailable; HTML stays the master |
| Version history trimmed after a month | `design/` must be committed; Figma is not the archive |
| 3 pages per file | one page for the system, one for screens, one spare |
