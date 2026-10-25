# 0004 – Transaction ownership through its account

- **Status:** Accepted
- **Date:** 2026-10-01

## Context

Data is owned by a user (`userId`), there is no `Workspace` entity in the MVP. A later move to
multitenancy (`workspaceId`) should be a schema migration plus one place in the access-control logic,
not a rewrite of every query.

## Decision

- `Account` and `Category` carry `userId`.
- `Transaction` has **no** `userId`; its owner is `account.userId`.
- The ownership check lives in one place, the ownership layer in `modules/core`, not in scattered `WHERE userId = …` clauses.
- Delete behaviour:
  - deleting a user cascades to their accounts and categories;
  - an account that still has transactions cannot be deleted (`Restrict`, the API should answer 409);
  - deleting a category keeps its transactions and sets `categoryId` to null (`SetNull`). _Changed by [0014](./0014-category-names-and-delete.md): a category that still has transactions cannot be deleted (`Restrict`, 409)._

## Alternatives considered

- **`userId` on every table, including `Transaction`** – simpler filters, but a redundant column that can disagree with `account.userId` and invites ownership checks spread across queries.

## Consequences

- The DB does not guarantee that a transaction's category belongs to the same user as its account. The service must check it (and the ownership layer must support this).
- Listing a user's transactions goes through the account relation.
- `Account` and `Category` carry a nullable `tenantId` (always `NULL` in the MVP); the ownership layer and the path to workspaces are in [0012](./0012-ownership-layer.md).
