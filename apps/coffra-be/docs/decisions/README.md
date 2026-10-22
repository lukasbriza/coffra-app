# Architecture decisions

One file per significant architectural decision, named `NNNN-kebab-title.md` (next free number).
Written when a choice between real alternatives has lasting consequences. The CLAUDE.md of the app
says when to write one and how.

## Format

```md
# NNNN – Title

- **Status:** Proposed | Accepted | Superseded by NNNN
- **Date:** YYYY-MM-DD

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

| #                                                    | Decision                                                          | Status   |
| ---------------------------------------------------- | ----------------------------------------------------------------- | -------- |
| [0001](./0001-modular-monolith.md)                   | Modular monolith with domain modules                              | Accepted |
| [0002](./0002-multi-file-prisma-schema.md)           | Prisma schema split by domain, one client                         | Accepted |
| [0003](./0003-transfer-as-paired-rows.md)            | Transfer stored as two paired rows                                | Accepted |
| [0004](./0004-ownership-through-account.md)          | Transaction ownership through its account                         | Accepted |
| [0005](./0005-money-and-currency.md)                 | Money as Decimal, currency per account                            | Accepted |
| [0006](./0006-stateless-jwt-session.md)              | Stateless own JWT session after OIDC login                        | Accepted |
| [0007](./0007-commonjs-and-esm-only-deps.md)         | Stay CommonJS, pin or avoid ESM-only packages                     | Accepted |
| [0008](./0008-oidc-client-library.md)                | `openid-client` v6 as OIDC client, `module: node20`               | Accepted |
| [0009](./0009-login-checks-in-signed-cookie.md)      | OIDC login checks in a short-lived signed cookie                  | Accepted |
| [0010](./0010-token-delivery-and-logout.md)          | Token delivery, fixed refresh expiry, IdP logout                  | Accepted |
| [0011](./0011-global-jwt-guard.md)                   | Global default-deny JWT guard, `@Public()` opt-out                | Accepted |
| [0012](./0012-ownership-layer.md)                    | Ownership layer: owner scope in the query, foreign equals missing | Accepted |
| [0013](./0013-opening-balance-and-fixed-currency.md) | Opening balance as an account field, currency fixed at creation   | Accepted |
| [0014](./0014-category-names-and-delete.md)          | Category names unique and case-sensitive, used category kept      | Accepted |
| [0015](./0015-income-and-expense-transactions.md)    | Transactions: scoped reference reads, read-only transfer sides    | Accepted |
| [0016](./0016-transactions-list.md)                  | Transactions list: keyset cursor, filters as predicates, indexes  | Accepted |
| [0017](./0017-transfers.md)                          | Transfers: one resource over the pair, atomic writes, no category | Accepted |
