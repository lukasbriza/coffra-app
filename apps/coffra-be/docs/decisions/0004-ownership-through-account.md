# 0004 – Transaction ownership through its account

- **Status:** Accepted
- **Date:** 2026-10-01
- **Milestone / task:** M0, #1 (T1); ownership layer in T13

## Context

Data is owned by a user (`userId`), there is no `Workspace` entity in the MVP. A later move to
multitenancy (`workspaceId`) should be a schema migration plus one place in the access-control logic,
not a rewrite of every query.

## Decision

- `Account` and `Category` carry `userId`.
- `Transaction` has **no** `userId`; its owner is `account.userId`.
- The ownership check lives in one place, the ownership layer in `modules/core` (T13), not in scattered `WHERE userId = …` clauses.
- Delete behaviour:
  - deleting a user cascades to their accounts and categories;
  - an account that still has transactions cannot be deleted (`Restrict`, the API should answer 409);
  - deleting a category keeps its transactions and sets `categoryId` to null (`SetNull`).

## Alternatives considered

- **`userId` on every table, including `Transaction`** – simpler filters, but a redundant column that can disagree with `account.userId` and invites ownership checks spread across queries.

## Consequences

- The DB does not guarantee that a transaction's category belongs to the same user as its account. The service must check it (and the ownership layer must support this).
- Listing a user's transactions goes through the account relation.
- The planned `tenantId` / `workspaceId` is not in the schema yet; see the open question in `docs/01_tasks.md`.
