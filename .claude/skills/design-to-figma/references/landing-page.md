# The landing-page pass

A marketing page is a different deliverable from an app screen, and it has its own generator.
This file says when that pass applies and how it plugs in. **It does not re-document taste-skill
— that skill's own `SKILL.md` is authoritative** and far more detailed than anything worth
copying here.

## When this pass, and not the app pipeline

| You are building | Pass |
|---|---|
| a screen behind the login — dashboard, list, form, settings | the app pipeline, phases 0–4 |
| the page that sells the product — hero, sections, pricing, footer | **this one** |

The two are not variants of each other. A landing page's content is written, not queried: its
hierarchy comes from a sales argument, its substance from photographs and copy. An app screen's
hierarchy comes from the data and one key question. A tool built for one produces slop in the
other.

## The generator

taste-skill, installed as `.claude/skills/taste-skill/`:

```bash
pnpm dlx skills add https://github.com/Leonxlnx/taste-skill \
  --skill "design-taste-frontend" --agent claude-code --copy --rename taste-skill -y
```

`--rename taste-skill` matters: it is the folder name `.gitignore` excludes, and the kit is tens
of megabytes of photographs and icons that must not be committed.

Version 2.5.x. It builds company and product websites and it owns its own run: palette and type
dealing, a page plan per kind, copy voice, photographs, moments, effects, and two gates. Read its
`SKILL.md` and follow it. The notes below are only what this repo adds.

## Declare the kind first

Its whole plan branches on the kind, which goes in the page's own metas. For a product like this
repo's — an app being sold — the kind is `software`, meaning the **marketing site for** the app:

| This repo's case | page type | site-kind |
|---|---|---|
| an app, SaaS, AI or fintech product selling itself | `software` | `software` |

Do not reach for `software` because the thing being designed is software. Reach for it because
the page sells software. An admin screen is neither.

It also wants two sentences from the brief, and the brief already has them:

- `--category "<what is sold>"` — from the Purpose line.
- `--primary "<main action>"` — the one thing a visitor should do. For a portfolio piece that may
  be "read the case study" rather than "sign up"; say which, because its gate checks it.

## Where the output lives

Scoped like everything else, in its own folder so it never collides with app screens:

| Artifact | Path |
|---|---|
| the page | `<ui>/design/landing/index.html` |
| its assets | `<ui>/design/landing/` as the generator writes them |
| its own state | `.taste-skill/` — gitignored, regenerable |
| report | `<ui>/design/reports/landing.md` |

The generator expects the page to be `index.html`. Keep that name; do not rename it to match the
app screens' convention.

## What is shared with the app design, and what is not

| Shared | Not shared |
|---|---|
| brand colours, if the product has any | the type scale |
| the logo and the product name | density and spacing rhythm |
| the Purpose line from `design/DESIGN.md` | the layout system, the sections, the motion |
| the Figma file and its token collections | the component vocabulary |

This is the part people get wrong in both directions. A landing page that inherits an app's dense
utility scale looks cramped and cheap; an app that inherits a landing page's generous editorial
scale wastes half the screen on a screen people use daily. **Shared brand, separate systems.**
Record the landing page's own scale under a `## Landing` section in `design/DESIGN.md`.

## Do not run both gates

taste-skill has its own start gate and finish gate, plus a copy lint, a consistency pass across
five widths and a performance check. Those replace the app pipeline's phase 3 for this page —
they are stricter and built for exactly this content.

Run the app pipeline's detector as a second opinion if you like: `pnpm dlx impeccable detect` is
cheap and catches generic defaults in any HTML. Do **not** run `designlang verify-ui --brand`
against `design/DESIGN.md` here — it would measure a marketing page against the app's direction
and fail it for being different, which is the point of it being different.

## Figma hand-off

Same route as an app screen — Tokens Studio for variables, html2figma for layers — with two
differences:

- A landing page is tall. The import produces one very long frame; put it on its own Figma page,
  not beside the app screens.
- Photographs become image fills, so the frame is heavy. Expect it to be slow, and do not promote
  photographic sections to components.

On a Starter plan this is a real cost: three pages per file. One for the system, one for app
screens, one for the landing page — and no spare.

## Order

Build the app first when both are in scope. The app's tokens and its real screens give the
landing page something true to show, and a product shot of a screen that exists beats an
invented mockup every time. A landing page built first has to invent the product it is selling.
