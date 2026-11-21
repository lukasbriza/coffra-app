# `design/DESIGN.md` — the direction record

Purpose and the requester's constraints are written by `/design-brief`; phase 1 fills the rest
and **must not touch those two sections**. Read by every later phase. It is the per-repo contract: what the design
is, why, and which values realise it. Repo-wide, because the tokens package is shared.

Treat it like an ADR. Changing it is a repo-wide revision with a stated blast radius, not an edit.

## Skeleton

Keep the platform sections even when only one platform exists. An empty `## Native` costs nothing
and forces phase 1 to decide what is shared — the decision that is hardest to change later.

```markdown
# Design — <project>

Figma file: <link, filled in after the first hand-off>
Plan: <path>   Issue: <url>

## Purpose

One line: what this design is for and who judges it. A portfolio piece and an internal tool
earn different directions, and the difference is invisible unless it is written down.

## Requester's constraints

What the requester ruled out or required, in their words. These are **binding**: the phase 3
gate treats a violated constraint as a finding, and a revision may not quietly drop one.

- <constraint> — <what it rules out>

Empty is fine. A constraint is checkable; an adjective is not. "Dark", "dense", "no
illustrations", "numbers carry hierarchy" belong here. "Premium" does not — it was either
turned into a constraint or dropped, and the command records which.

## Idea

One sentence, derived from brief facts. Not a mood, not adjectives.

## Direction

What was chosen, in concrete terms: the register, the density, what carries hierarchy.
It must satisfy every constraint above; say how, where it is not obvious.

### Rejected

- <direction B> — why not
- <direction C> — why not

## Shared across platforms

- Palette and colour semantics: <which token roles mean what>
- Motion intent: <what moves, and why — not durations>
- Radii and elevation as roles: <when each applies>
- Component vocabulary: `design/components.md`

## Web

- Type scale: <tokens, and the unit — rem>
- Spacing unit and density
- Layout: breakpoints that matter, what reflows
- Navigation pattern
- Fonts: family, weights, fallback stack

## Native

- Type scale: <tokens, unitless>
- Spacing and minimum touch target
- Layout constraints: no CSS grid, no hover
- Navigation pattern
- Fonts: family and how they load (`expo-font`)

## Token structure

Which sets exist and what each is for. Mirrors `design/tokens.config.json`.

## Figma

- File: <link>, worked in drafts
- Collections: one per token set
- Pages: system / screens / spare
```

## Rules

- **Facts, not adjectives.** "Dense, numbers carry hierarchy, one accent" is a direction.
  "Modern and clean" is nothing. The requester's own words go under Requester's constraints when
  they rule something out, and are dropped on the record when they do not.
- **Constraints bind.** They outlive the direction: re-dealing the direction keeps them. Removing
  one is the requester's call, never the agent's.
- **Record the rejected directions.** Two lines each. It is what stops the choice being
  re-litigated at screen four, and it is the same reason the repo keeps ADRs.
- **Shared before platform.** Anything that could be shared goes in the shared section. A value
  that differs per platform is a decision that needs its reason written down.
- **The Figma link belongs here**, added after the first hand-off, so the design and its render
  stay tied.
