# Discovery — taking the brief like a designer

Run by `/design-brief` — see that command for the steps. In the main thread, before any design exists. The output is
`design/DESIGN.md`'s Purpose and Requester's constraints, plus the key questions for the screens
that matter — the three inputs the rest of the pipeline cannot derive from a repo.

Two rules govern the whole conversation.

**Never ask what the repo already answers.** The contract gives the entities, the fields, the
enums and therefore the screens. Asking "what will the app do" wastes the requester's attention
and invites a vaguer answer than the schema already contains. Open by *showing* what you know and
asking them to correct it.

**Every question must have a destination.** Purpose, a constraint, a key question, a reference
URL, or a token decision. A question whose answer lands nowhere is a question not worth asking.

## Open by showing, not asking

Read the contract, the Prisma schema and the decision records first. Then:

> From the contract I can see: accounts, categories, transactions, transfers, and a dashboard
> with monthly totals and a trend. That maps to six screens.
>
> Before I design anything: is that the app, or is something missing or not happening?

A correction here is worth more than any answer to "what should it do".

## Round 1 — the five that matter

Ask these together, numbered, and accept short answers. Stop and design if they already
determine the direction; do not continue out of completeness.

1. **Who opens this, and what are they about to do?**
   One or two sentences. "Me, on Sunday, checking whether I overspent" is a complete answer.
   → Purpose.

2. **Which screen do you open most, and which would you show someone?**
   Offer the derived list. Their answer picks the first screen to design and tells you which
   screens are plumbing. → screen priority; also the first `/design` target.

3. **When you open that screen, what are you trying to find out?**
   For the top screen only, two at most. The single most load-bearing line in the brief: one
   question per screen is what produces one visual hierarchy.
   → key question, marked as theirs.

4. **How often, where, and on what?**
   Daily on a phone on the sofa is a different design from monthly at a desk with two monitors.
   → density, touch targets, and whether a native platform is in scope at all.

5. **What would make you close it and not come back?**
   The constraint harvester. Negatives are far more informative than positives and they arrive
   already checkable: "I don't want to scroll to see the month's total", "I don't want it to look
   like a bank app". → Requester's constraints.

## Round 2 — the look

Three routes, and a combination is fine. Offer them as lettered options so answering is one
keystroke.

> **a)** Reference URLs — name two or three products whose interface you like. Best input.
> **b)** Pick a starting direction from the list below.
> **c)** Have three candidates dealt from your answers, and choose on a real screen.

If **b**, offer directions described by **properties, not moods** — a mood word here would
reintroduce exactly what the pipeline rejects:

| | Properties |
|---|---|
| Data-first | dense rows, borders over shadows, tabular numerals, one accent colour, type does the work |
| Calm | generous spacing, few elements per view, large type, almost no colour |
| Editorial | strong type hierarchy, asymmetric layout, one large number per view, wide margins |
| Utility | compact controls, visible affordances, everything on one screen, no decoration |

Then one question that has a real cost behind it:

6. **Light or dark — which one?**
   On a Figma Starter plan a collection has one mode, so light and dark are two token sets and
   two designs. Say that. Picking both is a legitimate answer; it roughly doubles the work.

## Round 3 — only when relevant

Skip any that the answers so far already settled.

7. **Anything already fixed?** An existing logo, colour, or font you are committed to.
   One question avoids a redesign later. → constraints.
8. **The awkward extremes.** The most accounts you would have, transactions in a heavy month,
   the longest category name you would actually type. → layout, truncation, table versus list.
9. **Anything that has to be visible without scrolling or clicking?**
   → hierarchy, and a checkable constraint.
10. **Anything about how you read screens?** Small text, glare, colour vision — ask once,
    plainly, and take "no" for an answer. → constraints.
11. **What do you want out of this?** A Figma file to show someone, a design to implement from,
    or options to choose between. → Purpose, and it sets what "done" means.

## Conversation rules

- **Rounds, not a wall.** Five questions, then the look, then only what is still open. Eleven at
  once gets eleven shallow answers.
- **Short answers are complete answers.** Do not push for detail the design does not need.
- **Never ask for an adjective.** If one arrives anyway, ask what would make it wrong, and record
  the constraint behind it. "Premium" is not a constraint; "no stock photography, no gradients"
  is.
- **Reflect each answer back as its destination**, so a misread is caught in the conversation
  rather than in a built screen.
- **One follow-up maximum per question.** This is a brief, not an interrogation.
- **Do not design here.** No layouts, no colours, no component suggestions. Discovery that drifts
  into designing produces a direction nobody chose.

## Output

Write `design/DESIGN.md` with **only** these sections filled:

- `Purpose` — one line, from questions 1 and 11.
- `Requester's constraints` — from 5, 7, 9, 10, each phrased as what it rules out.
- `Figma`, `Token structure`, `Idea`, `Direction`, `Web`, `Native` — left as the skeleton's
  placeholders. **Phase 1 fills those and must not touch Purpose or the constraints.**

Record the key questions where they belong: either straight into `<ui>/design/brief.md` if it
exists, or in the hand-off line below for `/design` to carry.

Then print the exact next command, with the reference URLs if any were given:

```
/design <their most-used screen> "<their key question>" https://<ref> https://<ref>
```

Close with one line: the constraints are binding, re-dealing the direction keeps them, and only
they can remove one.
