---
name: design-to-figma
description: Use when designing or redesigning a frontend — producing screen designs, choosing a visual direction, writing design tokens, reviewing a UI for generic "AI slop", or exporting a design into Figma. Triggers on /design, "navrhni UI", "design the screens", "make a mockup", "pick a visual direction", and on any work in design/ or the tokens package. Not for implementing an already-approved design in React — that is coding-conventions plus the motion skills.
---

## Overview

Produces screen designs that read as deliberate rather than generated. The repo's API contract
supplies the content, a dealt direction supplies the form, and a deterministic gate blocks slop
before anything is handed off.

**`design/` in git is the source of truth. Figma is a one-way render of it.**

Everything here is **per repo**. The template ships examples, not a design system: the token set,
the direction and the component vocabulary are this project's own, derived from this project's
screens. The only universal rule is that a screen contains no value that is not a token.

Figma MCP is deliberately not wired: on a Figma Starter plan read and write tools share a
6-call monthly limit. Phase 4 is two manual plugin steps instead, at no cost.

## When to Use

- Designing a new screen, flow, or landing page
- Choosing or recording a visual direction or design tokens
- Revising an existing screen, the tokens, or the direction
- Exporting an approved design into Figma
- Reviewing an existing UI for generic patterns

## Two workspaces

The design and the facts rarely live in the same workspace. A frontend in `apps/<fe>` is designed
against a contract owned by `apps/<be>` and published by `packages/<name>-api`.

| | Meaning |
|---|---|
| `<ui>` | where the design output is **written** — the app being designed, or the repo root when shared |
| `<api>` | where facts are **read** — the workspace(s) with `prisma/schema.prisma` and `docs/decisions/` |

`<api>` may be several workspaces. Take them all, and track which field came from which.

`/design` detects the candidates and **confirms both with the requester before any work starts**,
because the subagent that does the work runs isolated and cannot ask. Given the wrong contract it
would build a plausible, wrong design and have no way to notice.

A fresh frontend app has no ADRs and no schema. Looking for domain semantics in `<ui>` finds
nothing and invites invention, which is the failure this skill exists to prevent. If the frontend
app does not exist yet, scaffold its shell first or write to the repo root —
`references/brief-from-contract.md` has the resolution procedure and both fallbacks.

### Web and native

Both platforms run the whole pipeline. What differs is the width and what the HTML is *for*.

| | Web `<ui>` | Native `<ui>` |
|---|---|---|
| Authored at | 1440, responsive down | 390, fixed |
| The HTML is | the implementation's source | **a drawing surface, thrown away** |
| Imported to Figma | yes | yes |

For a native target the HTML exists only to produce correct Figma frames in the same file, with
the same tokens and the same components. **It is never implementation input.** React Native has
no CSS, no grid and no hover; porting those files would produce something that compiles and is
wrong. Every native screen file carries a banner saying so — see `references/figma-authoring.md`.

The direction, the palette and the component vocabulary are shared. The scales are not: a native
type scale is unitless and its spacing has to clear a touch target. Record both in
`design/DESIGN.md` under their platform sections; see `references/design-record.md`.

Design the densest screen on the narrower platform first. A dense desktop table does not survive
translation to 390; the reverse is only a relaxation.

## Where design artifacts live

Output is scoped the same way `plan-project` scopes a plan.

| Artifact | Scope | Path |
|---|---|---|
| `brief.md` | the app being designed | `<ui>/design/brief.md` |
| `components.md` — shared vocabulary: roles, states, tokens | repo-wide | `design/components.md` |
| `components.md` — how this platform realises them | the app being designed | `<ui>/design/components.md` |
| `screens/<name>.html` | same | `<ui>/design/screens/` |
| `reports/<name>.md` | same | `<ui>/design/reports/` |
| `DESIGN.md` — direction, shared core, per-platform sections | repo-wide | `design/DESIGN.md` |
| `tokens.config.json` — exports → DTCG mapping | repo-wide | `design/tokens.config.json` |
| `tokens/*.json` — generated | repo-wide | `design/tokens/` |
| `landing/index.html` — the marketing page, if any | the app being designed | `<ui>/design/landing/` |

Write every document in the requester's language, and link the plan and the GitHub issue at the
top. Create folders when they are missing.

### What is committed

Unlike `plan-project`, whose plans are gitignored, most of this skill's output **is committed**.
That is deliberate: a Starter-plan Figma file trims its version history after a month, so git has
to be the archive. A plan is scaffolding for issues that live in GitHub; a screen is the source
the Figma file and the React implementation are both derived from.

| Path | Committed | Why |
|---|---|---|
| `design/DESIGN.md` | yes | a decision of record, like an ADR |
| `design/tokens.config.json` | yes | hand-maintained, and the generator needs it |
| `<ui>/design/brief.md` | yes | the data and key questions are judgement, not pure extraction |
| `design/components.md` | yes | the shared vocabulary every platform conforms to |
| `<ui>/design/components.md` | yes | this platform's markup for that vocabulary |
| `<ui>/design/screens/*.html` | yes | the deliverable's source; Figma is only a render |
| `<ui>/design/reports/*.md` | yes | records which findings were accepted on purpose |
| `<ui>/design/reports/**/*.png` | no | screenshots, regenerable |
| `design/tokens/*.json` | no | generated from the tokens package |

## Before anything runs

```bash
node .claude/skills/design-to-figma/scripts/preflight.mjs
```

Checks the runtime, the tokens package and the project's design files, and prints the exact
install command for whatever is missing. Exits non-zero when a required item
is absent, so `/design` can stop and ask the requester to install rather than failing three
phases in.

**An app screen needs nothing installed.** There is no external generator: the facts come from
the contract and the form is dealt here, by procedure, in `references/directions.md`. The
detector and the brand check run straight from `pnpm dlx`; screenshots use the Chromium already
on the machine. Only the two Figma plugins are manual, and preflight lists them as a reminder.

A marketing page is a different deliverable with its own generator — `references/landing-page.md`.
Tool inventory and pins: `references/external-skills.md`.

## Pipeline

Run in order. Every gate blocks the next phase. Phases 1–3 belong in the `design-build` subagent —
reading the contract and the decision records, dealing three directions and building a screen
costs a lot of tokens, which must not land in the main thread.

| # | Phase | Output | Gate |
|---|---|---|---|
| 0 | Ground | `<ui>/design/brief.md` | brief contains zero style adjectives |
| 1 | Direction | `design/DESIGN.md`, the tokens package | tokens committed, structure recorded |
| 2 | Build | `<ui>/design/screens/<name>.html` | real data, flex-only, every value a token |
| 3 | Verify | `<ui>/design/reports/<name>.md` | detector findings = 0, or accepted in writing |
| 4 | Project | Figma file | manual, two plugins, variables first |

### Driving it: your input, and the first run

Your own idea, constraints and the key question arrive as free text on the `/design` line — or
through the `/design-brief` interview, whose question set is `references/discovery.md`. Either
way they land in one of three places, with different weight:

| Kind | Destination | Binding? |
|---|---|---|
| Purpose — what the output is for, who judges it | `design/DESIGN.md` → Purpose | shapes the direction |
| Constraint — rules something out, checkable | `design/DESIGN.md` → Requester's constraints | **yes — a violation is a gate finding** |
| Content intent — what a screen is for | `<ui>/design/brief.md` → key question | overrides the derived one |

The first run has a different shape from the rest, and getting it wrong is expensive: do not
settle the direction on its own for a single screen, pick the hardest screen first, and spend the
one-screen window deliberately — that is when a direction change is still cheap.

Both of those, in full: `references/workflow.md`.

### Phase 0 — Ground

Resolve `<ui>` and `<api>` first. Then extract facts: the published contract in `packages/*-api`,
the Prisma schema and decision records in `<api>`, and the plan from `<ui>` or `<api>`. Invent
nothing, and do not ask the user for style words.
Procedure and extraction order: `references/brief-from-contract.md`.

### Phase 1 — Direction

Once per repo, not per screen. Skip to phase 2 when `design/DESIGN.md` already exists — read it
and conform. Changing it later is a revision with a blast radius; see below.

1. If the user supplied reference URLs, run the extractor per URL. Raw material only — never ship
   an extracted system as the design.
2. Deal three candidate directions, pick one, derive the idea sentence from brief facts. They
   must differ structurally, not by shade — the procedure and the axes are in
   `references/directions.md`. Record the two rejected ones and why, so the choice is not
   re-litigated at screen four.
3. **Derive the token set from the brief, not from a list.** The screens say how many text levels,
   how many surfaces and which states this app actually needs. If the tokens package is missing,
   scaffold it from the template and then reshape it — the template is a starting example, not a
   schema to conform to.
4. Write `design/DESIGN.md` from the skeleton in `references/design-record.md` — keep the
   platform sections even with one platform. Record the token structure there, and map it in
   `design/tokens.config.json`
   so `scripts/tokens-to-dtcg.mjs` can project it. A project scaffolded from this template
   usually had to rename its packages to avoid workspace-name collisions, so set `entry`
   explicitly rather than trusting the default. See `references/tokens-contract.md`.

### Phase 2 — Build

One static HTML file per screen. Web: **desktop-first at 1440, responsive down**. Native:
**fixed 390, with the throwaway banner**. Every value from the brief — never lorem, never a
placeholder amount.

**Read both component files before writing markup, and append to both afterwards.**
`design/components.md` holds the shared vocabulary — a role, its states, its tokens.
`<ui>/design/components.md` holds how this platform realises it. That split is what lets a web
card and a native card be the same component without pretending they are the same markup, and it
is what stops screen three inventing a third card style that passes the token gate and still
looks unrelated to screen one.

The authoring rules are not stylistic preferences: they decide whether the Figma import produces
Auto Layout or a pile of absolute frames. Read `references/figma-authoring.md`.

### Phase 3 — Verify

Both the brand check and the inspector want a URL, so the screens have to be served.

```bash
python3 -m http.server 4321 -d <ui>/design/screens >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT

pnpm dlx designlang verify-ui localhost:4321/<name>.html --brand design/DESIGN.md
```

Use `python3 -m http.server`, not `pnpm dlx serve`. Two tested reasons: `serve` answers `301` on
`/<name>.html` and redirects to the extensionless path, and `kill $SERVER` kills only the `pnpm dlx`
wrapper, so the real server keeps the port and the next run reads a stale page. If you must use
`serve`, start it with `setsid`, tear it down with `kill -- -$SERVER`, and drop the `.html` from
the URL.

Screenshots are our own, no dependency — Chrome's `--screenshot` flag does it:

```bash
node .claude/skills/design-to-figma/scripts/shoot.mjs <ui>/design/screens/<name>.html
```

Writes `<name>-1440.png`, `-768.png`, `-390.png` into `<ui>/design/reports/<name>/`, so the
report is self-contained. `--widths` and `--height` override the defaults.

The deterministic detector needs no server and no install. It reads the file, and its **exit
code is the gate**:

```bash
pnpm dlx impeccable detect <ui>/design/screens/<name>.html --json 2>/dev/null > detect.json
# 0 = clean, non-zero = findings. pnpm's progress goes to stderr, so the JSON stays parseable.
```

It covers WCAG AA contrast, so there is no separate contrast check.

**Never read its status through a pipe.** `detect … | head` returns `head`'s exit code, which is
always 0, and a page with every warning in the book then looks clean. Redirect first, read `$?`,
then look at the JSON.

Write findings, scores and screenshot paths to `<ui>/design/reports/<name>.md`. Fix and re-run,
**at most twice**; then report what is left rather than looping on a pass that costs a lot of
tokens each time. A finding kept on purpose is recorded with its reason,
never silently suppressed.

**Never hand a failing page to phase 4.** Repairing a layer tree inside Figma costs far more than
repairing the HTML that produced it.

### Phase 4 — Project to Figma

Manual and in this order. Variables must exist before layers can bind to them.

1. Tokens → Figma variables, via Tokens Studio. `references/tokens-contract.md`.
2. Screens → layers: set the browser window to the screen's authored width — 1440 for web, 390
   for native — and drop `<ui>/design/screens/<name>.html` into the html2figma plugin.
3. Promote each entry in `components.md` to a Figma component, bind variables, rename layers.
4. Put the Figma file's link in `design/DESIGN.md`, so the design and its render stay tied.

**For a web screen only the 1440 width reaches Figma.** The import captures the rendered width,
so the responsive reflows are reviewed as screenshots in the report, not as Figma frames. A
narrow layout that is a design in its own right rather than a reflow is a separate screen — and
in a repo with a native app, it usually belongs to the native `<ui>` instead.

On Starter, components stay file-local and cannot be published — keep the whole system in one
file, and work in **drafts** (unlimited) rather than the team folder (3 files).

Figma edits do not survive a re-import. Treat the file as output: fix the HTML and re-import,
and name the new frame `<name> vN` rather than importing over the old one.

## Landing pages are a different pass

The page that sells the product is not a variant of a screen behind the login. Its hierarchy
comes from a sales argument and its substance from copy and photographs; an app screen's comes
from the data and one key question. A tool built for one produces slop in the other.

That pass has its own generator, its own gates and its own output folder:
`references/landing-page.md`. Brand colours are shared with the app design; the type scale,
density and component vocabulary deliberately are not.

Build the app first when both are in scope — a product shot of a screen that exists beats an
invented mockup, and a landing page built first has to invent the product it is selling.

## Revising

A revision's blast radius is decided by what changed, and is stated before any work starts.

| Changed | Re-run |
|---|---|
| one screen | phases 2–3 for that screen |
| `components.md` entry | phases 2–3 for **every screen that uses it** |
| tokens | the token export, phases 2–3 for **all** screens, re-import variables |
| the direction in `DESIGN.md` | phase 1 onwards for the whole repo |

Changing the direction after screens exist is expensive and usually wrong. Say what it will cost
and get an explicit yes before starting. Never re-deal the direction while building a screen —
that is how three finished screens stop matching.

## Scope boundaries

| Concern | Belongs to |
|---|---|
| Turning a brief into a plan and tracked tasks | `plan-project` (runs first) |
| Visual direction, tokens, screen layout | this skill |
| Motion, transitions, scroll animation | phase 5, separate skills |
| React implementation, naming, structure | `coding-conventions` |
| Render performance | `web-performance` / `native-performance` |

## Common Mistakes

| Mistake | Instead |
|---|---|
| Asking the user for "modern" or "premium" | ask what would make it wrong; record the constraint |
| Passing the requester's adjectives through raw | classify them, or drop them on the record |
| Dropping a stated constraint during a revision | constraints outlive the direction |
| Building a screen before tokens are committed | phase 1 first, always |
| Treating the template's token set as the schema | derive it from the brief; the template is an example |
| Hardcoding a value because no token exists | add the token, then reference it |
| Building screen N without reading `components.md` | read first, append after |
| Lorem ipsum, `$1,234.00`, "Category 1" | real amounts, dates and names from the brief |
| `position: absolute` for layout | flex or grid only |
| Running the gate without serving the screens | both checks want a URL |
| Looping on the gate until it is perfect | two rounds, then report what is left |
| Importing into Figma to preview the result | the gate is phase 3; import is a hand-off |
| Re-dealing the direction mid-build | that is a repo-wide revision; stop and ask |
| Fixing a layer tree inside Figma | fix the HTML and re-import as `vN` |
| Running the whole pipeline in the main thread | dispatch `design-build` |
| Guessing the workspaces inside the subagent | `/design` confirms them first; the subagent stops instead |
| Looking for ADRs or a schema in the frontend app | they live in `<api>`; `<ui>` has none |
| Writing into an app that is not scaffolded yet | scaffold the shell, or use the repo root |
| Porting a native screen's HTML into React Native | it is a drawing surface; read Figma and the tokens |
| One `components.md` doing both platforms | shared roles repo-wide, markup per `<ui>` |
| A native screen authored at 1440 | 390, fixed |
| Reaching for animated component libraries | runtime-only, no Figma representation |
