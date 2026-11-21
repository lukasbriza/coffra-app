# Phase 1 — dealing three directions

No external tool does this. The app-screen pipeline has no generator: the facts come from the
contract and the form is decided here, by you, from the brief.

The purpose of dealing three is not variety for its own sake. It is to stop the first idea from
winning by default — the first idea is almost always the mean of everything you have seen, which
is exactly what reads as generated.

## Make them genuinely different

Three candidates differ on **structure**, not on shade. The test: if swapping the palette makes
two of them identical, they are one candidate with two skins. Pick three points that sit far
apart on these axes, not three neighbours.

| Axis | Range |
|---|---|
| What carries hierarchy | size · weight · colour · position · whitespace |
| Density | every row visible, scan-first · comfortable, read-first · one figure per view |
| How records are shown | table · cards · list with inline detail |
| Colour's job | neutral chrome plus one accent · category-coded · near-monochrome, type does the work |
| Type | one family two weights · a pairing · separate numeral treatment (tabular, mono) |
| Edges | hairline borders · surface elevation · nothing, spacing alone separates |

A candidate names its choice on each axis. "Dense table, hierarchy by weight, neutral with one
accent, tabular numerals, hairline borders" is a candidate. "Clean and modern" is not.

## Derive each from the brief, not from a mood

Every candidate must answer the screen's **key question** better than the other two in some
specific way, and the pitch says how:

> **A — Ledger.** Every transaction of the month visible without scrolling; hierarchy by weight
> so the total reads first. Answers "did I overspend" at a glance, loses the per-category story.
>
> **B — Category-led.** Categories are the structure, each with its share of income. Answers
> "where did it go" first; the individual transaction needs a second click.
>
> **C — One figure.** The month's number dominates; everything else is secondary and scrollable.
> Answers "am I fine" instantly, and is the weakest of the three for anything more.

The trade-off sentence is not optional. A candidate with no cost is a candidate nobody examined.

## Honour the constraints

The requester's constraints in `design/DESIGN.md` are binding on **all three**. A candidate that
violates one is not a candidate — it is a candidate you have to replace. Constraints narrow the
space, which is why they make this step easier rather than harder.

If the constraints leave no room for three genuinely different candidates, say so and present
two. Padding to three with a variant is worse than admitting the space is narrow.

## Judge on a real screen, not on the description

Pick the one that best answers the key question, build **that one** as the screen, and look at
it. The description is not the design: a candidate that reads well and looks wrong is common, and
it is the reason the one-screen window matters.

Record in `design/DESIGN.md`:

- the chosen direction, as its axis choices plus the idea sentence;
- the other two under Rejected, one line each, with **why not** — that is what stops the choice
  being re-litigated at screen four.

## Idea sentence

One sentence, from brief facts, that a later screen can be checked against. It states what the
design does, not how it feels.

- Good: "Numbers lead, chrome recedes, one accent marks only what needs action."
- Useless: "Clean, modern and trustworthy."

If a screen cannot be checked against the sentence, the sentence is a mood and needs rewriting.

## References, when there are any

`pnpm dlx designlang <url>` on a product the requester admires reports its real colours, type,
spacing, radii, shadows and motion. Use it as **raw material for the axes** — it tells you what
density and what colour discipline actually look like in production.

Never ship an extracted system as the design. It belongs to someone else's content, and it was
built for their key question, not this one.
