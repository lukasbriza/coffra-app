# Phase 0 — brief from the contract

The brief is the anti-slop mechanism. A generator asked for "a modern finance dashboard"
invents a finance dashboard; the same generator given real entities, real field names, real
enum values and a stated question per screen has nothing left to invent. Everything here is
extraction, not authoring.

## Two workspaces, not one

The design and the facts almost never live in the same workspace. A frontend in
`apps/<fe>` is designed against a contract owned by `apps/<be>` and published by
`packages/<name>-api`. Resolve both before extracting anything.

| Placeholder | Meaning | Typical value |
|---|---|---|
| `<ui>` | where the design output is written | the app being designed; the repo root when shared across several apps |
| `<api>` | where the contract and its semantics are read from — one or several | the workspace holding `prisma/schema.prisma` and `docs/decisions/` |

**Resolution is the main thread's job, not the subagent's.** `/design` detects the candidates,
confirms both with the requester, and passes them in. A subagent runs isolated and cannot ask,
so it treats them as given and stops rather than guessing. The detection rules below exist for
the command, and for a human reading this.

To find `<api>` mechanically:

1. `packages/*-api/src/schema.json` is the published contract. One hit is the normal case.
2. The owning app is the `apps/*` that exports it — it has `prisma/schema.prisma`, an
   OpenAPI export script or `tsconfig.openapi.json`, and a populated `docs/decisions/`.
3. Several backends are a legitimate answer, not an ambiguity to resolve away. Take them all,
   read each one's contract and ADRs, and record per field which `<api>` it came from — two
   services can spell the same concept differently, and a screen that merges them silently is
   how a contract mismatch reaches production.

`<ui>` and `<api>` are frequently the same workspace for a full-stack app, and never the same
for this monorepo's split. Do not read ADRs from `<ui>` and expect to find domain semantics —
a fresh frontend app has none.

### When the frontend app does not exist yet

Designing before the app is scaffolded is normal, and a path cannot be scoped to a workspace
that is absent. Two options:

1. **Scaffold the shell first** (preferred). One command — `pnpm turbo gen app-next` or
   `app-react` — and `<ui>` is unambiguous. The design needs the app's routes anyway, and the
   app needs `packages/tokens` and `packages/api` wired regardless.
2. **Write to the repo root** `design/` and move it into `<ui>/design/` once the app exists.
   Consistent with the rule that anything not owned by one workspace goes to the root.

Never invent a path inside an app that is not there.

## Extraction order

Read in this order. Earlier sources are machine-generated or decision-of-record, so they win
over prose when they disagree.

| # | Source | Where | Gives |
|---|---|---|---|
| 1 | OpenAPI schema | `packages/*-api/src/schema.json` | endpoints, request/response shapes, enums, required fields, status codes |
| 2 | Prisma schema | `<api>/prisma/schema.prisma` | entities, relations, nullability, defaults, uniqueness |
| 3 | Decision records | `<api>/docs/decisions/*.md` | the domain semantics a schema cannot express |
| 4 | Plan | `<ui>/docs/plans/`, then `<api>/docs/plans/` | goal, scope, milestones, explicit non-goals |
| 5 | Issue tracker | `gh` — see `plan-project/references/github.md` | what shipped versus what is still open |
| 6 | Workspace context | `<ui>/CLAUDE.md`, `<api>/CLAUDE.md`, root `CLAUDE.md` | locale, currency, stack decisions |

If source 1 exists, never guess a field name or an enum value. Read it.

The contract in `packages/*-api` is what the frontend actually consumes, so it — not the
backend's controllers — decides what a screen can show. Read the backend only for the
semantics behind it.

Do not read `graphify-out/` — see the root `CLAUDE.md`.

## Decision records are the richest source

ADRs record why a thing works the way it does, and therefore the semantics a screen has to
respect: how money is represented, what a transfer actually is, which totals a dashboard is
allowed to claim. The schema gives you the shape; the ADRs give you the meaning.

They are also bulky — a mature app can carry thirty of them. Do not read them all.

1. Read `<api>/docs/decisions/README.md` first. It is the index.
2. From the index, open only the ADRs that name an entity, metric or flow on this screen.
3. Record the resulting constraint in the brief, and cite the ADR by number.

The same restraint applies to a per-app `CLAUDE.md`, which can run to tens of thousands of
words. When all you need is the locale or the currency rule, grep it; do not load it whole.
The backend's `CLAUDE.md` is usually the larger of the two — grep that one in particular.

## Plans

A design usually implements an already-approved plan. Look in `<ui>/docs/plans/` first, then
`<api>/docs/plans/` — a backend task often carries the requirements a screen has to meet. Read
it before anything else in the list above: it states the goal and, more usefully, the non-goals.

Older projects predate this convention and may keep a single plan at the repo root under
another name. Glob `docs/*plan*.md` as a fallback before concluding no plan exists.

Tasks live in GitHub, not in a file. For what has actually shipped, query issues rather than
trusting any checklist committed to the repo.

## Deriving screens from endpoints

A screen is not a guess. Map the contract mechanically, then cut:

| Endpoint shape | Implied screen |
|---|---|
| `GET /x` returning a collection | list or table of `x` |
| `GET /x` with query params | the same list, plus a filter bar built from exactly those params |
| `POST /x` + `PATCH /x/{id}` | one create/edit form, fields from the request body |
| `GET /x/{id}` | detail view |
| `DELETE /x/{id}` | a destructive confirm, inside the list or detail |
| an aggregate or summary endpoint | a dashboard panel per field in the response |
| auth callback / session | sign-in, and the signed-out state |

Then cut to what was asked for. Designing eleven screens when the request was the dashboard
is its own failure mode.

## What the brief must contain

Write it to `<ui>/design/brief.md`, in the requester's language. One section per screen,
every line traceable to a source above.

```markdown
## <screen name>

- Route: <path>
- Endpoints: <method path>, <method path>
- Key question: the one thing the user opens this screen to find out
- Role: who is looking (from the auth model; single-user is a valid answer)
- Fields: <name> (<type>, <enum values | range>, <required?>)
- Volume: how many rows or items in a realistic month
- Empty state: what is true before any data exists
- Failure states: which status codes the contract can return here
- Constraints: semantics from `<api>` ADRs, each cited by number
- Out of scope: what the plan explicitly defers
```

The **key question** is the most load-bearing line. A screen without one becomes a wall of
equally-weighted cards, which is exactly what generated output looks like. One question per
screen means one visual hierarchy, which means one thing is biggest.

Derive it from the contract, but **the requester's own key question wins** when they gave one —
they know which question matters, and the endpoints only show what is answerable. Record whose
it is: `Key question: <text> (requester)`. If their question needs data the contract cannot
return, that is a conflict to surface, not a gap to design around.

Link the plan and the GitHub issue at the top of the file, the way a plan links its issue and
its decisions. A brief nobody can trace back to a tracked task will drift from it.

## Realistic data rules

Placeholder data is the most visible tell of a generated design. Column widths, truncation and
alignment are all decided by the real shape of the values.

- Currency, number and date formats follow the project's locale. Read it from a workspace
  `CLAUDE.md`, an ADR, or an i18n config — never default to USD or `MM/DD/YYYY`.
- Amounts in plausible magnitudes for the domain, with the real spread: a few large values,
  many small ones, at least one negative where the model allows it.
- Names from the actual domain vocabulary — the categories a real user of this app would
  create, not `Category 1`.
- Include the awkward cases on purpose: the longest plausible label, a zero, a value that must
  truncate, a row that wraps.
- Dates clustered the way the domain clusters them, not evenly spaced.

## Gate

The brief passes when it contains **no style adjectives at all** — no "modern", "clean",
"premium", "minimal", "sleek", "professional". Those words carry no information and push the
generator toward the mean of its training data. If the requester supplied them, record them
under the direction in `design/DESIGN.md`, never in the brief.

Also check: every field name is spelled as the contract spells it, every screen has a key
question, every constraint cites its ADR, and the report names both resolved workspaces.
