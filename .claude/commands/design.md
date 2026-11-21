---
description: Design a screen or flow for Figma handoff with the design-build subagent
argument-hint: [target: screen | flow | "direction"] [--ui <path|name>] [--api <path|name>,...] [reference URLs] — no args shows status
allowed-tools: Task, Glob, Grep, Read, Bash(ls:*), Bash(git status:*), Bash(node .claude/skills/design-to-figma/scripts/preflight.mjs:*)
---

Design a UI for Figma hand-off using the **`design-build`** subagent. Arguments: `$ARGUMENTS`.

Resolution happens **here, in the main thread**, because the subagent runs isolated and cannot
ask the requester anything. Confirm both workspaces before dispatching — a design built against
the wrong contract is a full rebuild, and the subagent has no way to check.

## Steps

### 1. Parse

Split `$ARGUMENTS` into:

- `target` — first positional: a screen name, a flow, or `direction` to settle only the visual
  direction. **Missing → this is a status call:** run steps 2 and 5, print the report in step 3,
  and stop. Do not ask anything and do not dispatch.
- `--ui <path|name>` — the workspace the design is written to.
- `--api <path|name>[,<path|name>...]` — the workspace(s) the facts are read from. Repeatable
  and comma-separated; several backends are a valid answer.
- anything that looks like a URL → `referenceUrls`.
- **everything else, in quotes or not → `intent`**: what the requester wants. Do not drop it and
  do not pass it through raw; classify it in step 3b.

### 2. Detect candidates

| Role | How to find candidates |
|---|---|
| contract | `packages/*-api/src/schema.json` |
| `<api>` | `apps/*/prisma/schema.prisma`; `apps/*/docs/decisions/`; `apps/*/package.json` depending on `@nestjs/core` |
| `<ui>` | `apps/*/package.json` depending on `next`, `react-router` or `expo`. An `expo` app is a **native** target — same pipeline, 390 instead of 1440 |

Grep the manifests rather than reading them whole — a per-app `package.json` is cheap, a per-app
`CLAUDE.md` is not.

### 3. Status — bare `/design` only

Someone who types `/design` with no arguments does not know where to start, so answer that
question instead of asking one. Assemble from step 2 and the preflight output in step 5:

```
design-to-figma — status

Workspaces detected
  UI      apps/web (next) · apps/mobile (expo → native, 390)
  API     apps/<be>  + contract packages/<name>-api/src/schema.json

Direction
  design/DESIGN.md       absent — not settled yet
  design/components.md   absent

Screens implied by the contract        built    gated
  dashboard                             no       —
  accounts                              no       —
  transactions                          no       —
  transfers                             no       —

Preflight
  <relay the preflight output here, verbatim>

Next:  /design direction <reference URL>
```

How to fill it:

- **Screens** come from the endpoint mapping in `references/brief-from-contract.md`, applied to
  the contract found in step 2. List them; do not design them.
- **built** is whether `<ui>/design/screens/<name>.html` exists, for each `<ui>` candidate.
- **gated** reads the matching `<ui>/design/reports/<name>.md`: clean, or the open finding count.
- **Next** is the single most useful command: `/design direction <url>` when `design/DESIGN.md` is
  absent, otherwise `/design <first unbuilt screen>`. One suggestion, not a menu.
- If preflight exits non-zero, say that installing is the real next step and put its fix lines
  above the `Next:` line.

A status call never writes anything and never dispatches.

### 3b. Classify the requester's intent

Everything the requester said that is not a flag or a URL is intent, and it belongs in one of
three places. Routing it correctly is the difference between input that binds the design and
input that evaporates.

| Kind | Example | Destination |
|---|---|---|
| **Purpose** — what the output is for | "portfolio piece, a recruiter will look at it" | `design/DESIGN.md` → Purpose |
| **Constraint** — rules something out, checkable | "dark", "dense", "no illustrations", "monospace for numbers", "all 12 categories without scrolling" | `design/DESIGN.md` → Requester's constraints |
| **Content intent** — what a screen is for | "the key question is whether I can afford something this month, not what my balance is" | `<ui>/design/brief.md` → that screen's key question |

Rules:

- **A bare adjective is none of the three.** "Premium", "modern", "clean", "beautiful" rule
  nothing out and are the exact input the pipeline exists to reject. Ask one question to turn it
  into a constraint or a reference URL: *what would make it wrong?* If the answer is a constraint,
  record it; if it is a product they admire, take the URL. If neither, drop it and say so.
- **A content intent overrides the derived key question.** Phase 0 derives one per screen from
  the contract; the requester knows which question actually matters. Record theirs and note it
  came from them.
- **Check intent against the facts before dispatching.** "Lead with the monthly trend" needs a
  trend in the contract. If it is not there, say so and ask — do not dispatch a screen that shows
  data the API cannot return.
- **Echo the classification back** before dispatching, so a misrouted line gets corrected while
  it is still free:

> Purpose: portfolio piece, judged by a recruiter
> Constraints: dark · dense · numbers carry hierarchy
> Dashboard key question: can I afford something this month (yours, replaces the derived one)
> Dropped: "make it pop" — no constraint behind it

- With no intent at all, say nothing about it and carry on. Silence is a valid answer.

### 4. Ask

Ask the requester, even when detection looks unambiguous — pre-filled, so confirming is one word.
Skip only the parts already given as `--ui` / `--api`.

> Frontend design for: **apps/web** (detected: apps/web, apps/mobile)
> Contract and domain facts from: **apps/api** + packages/core-api (detected)
> Confirm, or name a different workspace (path or name, several for the API side).

Rules:

- Accept a bare workspace name (`coffra-be`) or a path (`apps/coffra-be`, `./packages/coffra-api`).
  Normalise to a repo-relative path and verify it exists; re-ask on a miss instead of guessing.
- Several `<api>` workspaces are fine. Pass them all through in order.
- `<ui>` may be the repo root when the design is shared across several apps.
- **No frontend app detected** — do not invent a path. Offer the choice:
  1. scaffold its shell now (`pnpm turbo gen app-next` or `app-react`), then design into it;
  2. write to the repo root `design/` and move it once the app exists.
- `target` = `direction` still needs `<api>`: the direction is judged against real screens.
- `target` = `landing` is the **marketing-page pass**, not a screen. It has its own generator and
  its own gates: read `references/landing-page.md` and follow taste-skill's own `SKILL.md`. Do
  not dispatch `design-build` for it — that agent builds app screens.
- **Native `<ui>`?** An Expo app runs the whole pipeline, authored at a fixed 390, and its HTML
  is a drawing surface that must never be ported to React Native. Say which platform you
  resolved when dispatching — it decides the width and the banner.
- **Both platforms?** Two `<ui>` workspaces over one `<api>`, one shared direction and one shared
  component vocabulary. Run them as separate `/design` invocations, narrower platform first: a
  dense desktop table does not survive translation to 390, the reverse is only a relaxation.
- **Existing screen?** If `<ui>/design/screens/<target>.html` is already there, this is a
  revision, not a rebuild. State the blast radius before dispatching and get a yes:
  one screen → phases 2–3 for it; a `components.md` entry → every screen using it; tokens → all
  screens plus a Figma variable re-import; the direction → phase 1 onwards for the whole repo.

### 5. Preflight

```bash
node .claude/skills/design-to-figma/scripts/preflight.mjs
```

It checks the runtime, the tokens package and the project's design files,
and prints the exact install command for anything missing. Run it on a status call too — that is
the invocation most likely to come from someone who has installed nothing yet.
**If it exits non-zero, relay its output verbatim and stop** — do not dispatch, and do not install anything yourself. The requester
installs, then runs `/design` again.

Nothing else needs installing: the detector runs straight from `pnpm dlx`, and the two Figma plugins
cannot be detected, so preflight lists them as a manual reminder.

An app screen needs nothing installed, so on this path preflight should pass clean on a fresh
machine with a browser and Python. taste-skill appears only under "landing pages only" — it is
not required here.

Then add what preflight does not cover:

- a plan in `<ui>/docs/plans/` or any `<api>/docs/plans/` — name it so the subagent reads it.

### 6. Dispatch

Hand off to `design-build`. Do not design inline — a full run costs several hundred thousand
tokens and must not land in the main thread.

Pass, explicitly: `target`, the confirmed `<ui>`, the confirmed `<api>` list, `referenceUrls`,
the classified `intent` with each item's destination, the plan path if one exists, the
and whether the direction is already settled. The subagent treats these as given and will stop rather than re-derive them.

### 7. Relay

Relay the subagent's report. Keep its hand-off steps verbatim — phase 4 is manual and the order
matters (variables before layers).

## Notes

- `direction` as the target settles tokens and `design/DESIGN.md` only, no screens. Worth running
  on its own **only when several screens follow immediately**. For a single screen, skip it: phase
  1 runs inside `/design <screen>` anyway, and a direction with nothing to look at cannot be
  judged. Say this when someone asks for `direction` with one screen in mind.
- **First screen in a fresh repo?** Suggest the densest one — the table or the dashboard, not the
  login page. A token set derived from a sparse screen does not survive a dense one. And say that
  the direction is cheap to change while exactly one screen exists, expensive after four.
- Reference URLs are raw material for the direction, never the design. Without them the subagent
  deals its candidates from the brief's facts — supported, not degraded. Mention once that
  supplying two or three is cheapest now, because adding a reference after screens exist is a
  direction revision with repo-wide blast radius. Do not press it.
- This command stops at HTML. Importing into Figma is two manual plugin steps — the skill's
  `references/figma-authoring.md` holds the procedure.
- For motion, component implementation or React, use the coding skills instead.
- If no plan exists and the work is sizeable, run `plan-project` first. A design without an
  agreed scope tends to grow screens nobody asked for.
