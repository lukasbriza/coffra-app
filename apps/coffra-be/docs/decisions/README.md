# Architecture decisions

One file per significant architectural decision, named `NNNN-kebab-title.md` (next free number).
Written when a choice between real alternatives has lasting consequences. The CLAUDE.md of the app
says when to write one and how.

## Format

```md
# NNNN – Title

- **Status:** Proposed | Accepted | Superseded by NNNN
- **Date:** YYYY-MM-DD
- **Milestone / task:** M0, #12

## Context

What forced the decision. Constraints, not a story.

## Decision

What we do, concretely.

## Alternatives considered

- Option – why not.

## Consequences

What gets easier, what gets harder, what to watch.
```

A decision is not edited after it is accepted, except to fix facts. To change course, add a new record
and mark the old one `Superseded by NNNN`.

## Index

| #                                            | Decision                                      | Status   |
| -------------------------------------------- | --------------------------------------------- | -------- |
| [0001](./0001-modular-monolith.md)           | Modular monolith with domain modules          | Accepted |
| [0002](./0002-multi-file-prisma-schema.md)   | Prisma schema split by domain, one client     | Accepted |
| [0003](./0003-transfer-as-paired-rows.md)    | Transfer stored as two paired rows            | Accepted |
| [0004](./0004-ownership-through-account.md)  | Transaction ownership through its account     | Accepted |
| [0005](./0005-money-and-currency.md)         | Money as Decimal, currency per account        | Accepted |
| [0006](./0006-stateless-jwt-session.md)      | Stateless own JWT session after OIDC login    | Accepted |
| [0007](./0007-commonjs-and-esm-only-deps.md) | Stay CommonJS, pin or avoid ESM-only packages | Accepted |
