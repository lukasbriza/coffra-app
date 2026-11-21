# Driving the pipeline

How the requester's input reaches the design, and what the first run should look like. The
pipeline itself is in `SKILL.md`; this is the part that depends on the person rather than the repo.

## Saying what you want

`/design-brief` takes the brief by interview before anything is designed — five questions, then
the look, then whatever is still open — and writes `design/DESIGN.md`'s Purpose and constraints.
Run it once per repo. It exists because composing Purpose, constraints and a key question in one
shot, unprompted, is the hardest part of the pipeline; `references/discovery.md` holds the
question set and the rules for running it.

Skipping it is fine. The same three inputs can arrive as free text on the `/design` line:

Either way the input lands in one of three places, and `/design` echoes where each piece went so
a misroute is caught before anything is built.

| Kind | Destination | Binding? |
|---|---|---|
| Purpose — what the output is for, who judges it | `design/DESIGN.md` → Purpose | shapes the direction |
| Constraint — rules something out, checkable | `design/DESIGN.md` → Requester's constraints | **yes — a violation is a gate finding** |
| Content intent — what a screen is for | `<ui>/design/brief.md` → key question | overrides the derived one |

```
/design dashboard "dark, dense, numbers lead. Portfolio piece — a recruiter will
  look at it. The key question is whether I can afford something this month."
```

A bare adjective is none of these. "Premium" rules nothing out, so `/design` asks one question —
*what would make it wrong?* — and records the constraint behind it, takes a reference URL, or
drops it on the record. That is the one place the no-adjectives rule bends, and it bends into
something checkable rather than into mood.

Constraints outlive the direction: re-dealing keeps them, and only the requester removes one.

## Starting from nothing

The first run is a different shape from the rest, and getting it wrong is expensive.

**Do not settle the direction on its own when you are building one screen.** Phase 1 runs inside
the first `/design <screen>` anyway — tokens have to exist before markup. Splitting it produces a
direction approved on paper, with nothing to look at; and the skill's own rule is that a
direction is judged against real screens.

Splitting is worth it only when several screens follow immediately, because then a bad direction
costs all of them.

**Pick the hardest screen first.** Not the login page — the densest one: the table, the dashboard,
the screen with filters and long labels and a negative number. A direction and a token set derived
from a sparse screen will not survive the dense one, and the reverse is only a relaxation.

**The one-screen window is when a direction change is cheap.** With exactly one screen built, a
re-deal costs that screen. With four, it costs the repo. So spend that moment deliberately: look
at the gate's 1440 / 768 / 390 screenshots, decide whether the direction holds, and only then
build screen two.

**No reference URLs is a supported path**, not a degraded one. The three candidates are dealt
from the brief's facts by the procedure in `references/directions.md`. References are better raw
material for the axes, so if there are two or three products in the same domain worth looking at,
now is the cheapest moment to supply them — after screens exist, adding one is a direction
revision with repo-wide blast radius.

Each later screen is then just `/design <name>`: it reads `design/DESIGN.md` and both
`components.md` files, conforms to them, and appends what it adds.
