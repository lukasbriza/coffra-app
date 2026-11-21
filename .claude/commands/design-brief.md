---
description: Take a design brief by interview, like a designer with a client, and write design/DESIGN.md
argument-hint: [--ui <path|name>] [--api <path|name>,...] [reference URLs] — no args is fine
allowed-tools: Glob, Grep, Read, Write, Bash(ls:*)
---

Interview the requester and write `design/DESIGN.md`'s Purpose and constraints. Arguments:
`$ARGUMENTS`.

Runs **here, in the main thread** — it is a conversation, so it cannot be a subagent. Read
`references/discovery.md` in the `design-to-figma` skill before the first question; it holds the
question set, the rounds and the output format.

## Steps

### 1. Ground yourself before asking anything

Resolve `<api>` as `/design` does, then read the contract (`packages/*-api/src/schema.json`), the
Prisma schema and `<api>/docs/decisions/README.md`. Derive the screen list from the endpoint
mapping in `references/brief-from-contract.md`.

**Do not ask what these answer.** Open by showing the derived screens and asking for a
correction. That one exchange is worth more than any question about what the app should do.

### 2. Check whether this has already happened

If `design/DESIGN.md` exists with a filled Purpose, say so and stop — re-running discovery
rewrites a settled record. Offer the two real options instead: revise one constraint, or start
over deliberately, which is a repo-wide revision.

### 3. Interview

Follow `references/discovery.md`: five questions, then the look, then only what is still open.
Reflect every answer back as its destination. Never ask for an adjective; when one arrives, ask
what would make it wrong and record the constraint behind it.

### 4. Write

Create `design/DESIGN.md` from the skeleton in `references/design-record.md` with **only**
`Purpose` and `Requester's constraints` filled. Everything else stays a placeholder — phase 1
deals the direction and fills the rest, and it must not touch what you wrote.

### 5. Hand off

Print the exact command to run next, carrying their key question and any reference URLs:

```
/design <most-used screen> "<their key question>" https://<ref>
```

Say in one line that the constraints are binding, that re-dealing the direction keeps them, and
that only they can remove one.

## Notes

- Run this once per repo, before the first `/design`. Skipping it is fine — `/design` classifies
  free-text intent on its own. This exists because composing Purpose, constraints and a key
  question in one shot, unprompted, is the hardest part of the whole pipeline.
- It writes one file and designs nothing. No screens, no tokens, no Figma.
- A requester who answers "I don't know" to the look should take route **c** and judge the three
  dealt candidates on a real screen. That is cheaper than deciding in the abstract.
- If their answers conflict with the contract — a screen they want that the API cannot feed —
  surface it here. It is far cheaper than discovering it in phase 2.
