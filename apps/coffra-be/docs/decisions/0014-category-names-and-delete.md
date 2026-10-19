# 0014 – Category names unique and case-sensitive, a used category cannot be deleted

- **Status:** Accepted
- **Date:** 2026-10-18
- **Milestone / task:** M2, #19 (T15)

## Context

Categories are per user (ADR [0004](./0004-ownership-through-account.md)); the unique `(userId, name)` exists since M0 and the dashboard (T21) aggregates income and expense by category. Two things about them are hard to change once there is data:

- **How names compare.** Most applications treat `Food` and `food` as the same name. Going from case-sensitive to case-insensitive later means merging the colliding categories of every user (and moving their transactions); the other way round is free.
- **What deleting a used category does.** M0 chose `onDelete: SetNull` (ADR 0004): the category goes and its transactions silently lose their tag. One click then rewrites the category breakdown of every past period on the dashboard, and nothing can undo it.

## Decision

- **Names:** trimmed (`@IsResourceName()`), otherwise stored and compared as they are: `Food` and `food` are two categories. No case folding in the DTO, the service or the database (the unique index is a plain byte comparison).
- **Uniqueness is decided by the database.** The service maps `P2002` of a create or a rename to `409 Category with this name already exists`, with no lookup beforehand, so two parallel requests cannot both pass. `meta.target` is not read: the shape differs between driver adapters, and the id is a generated UUID, so a unique violation on a category is always its name.
- **A category that still has transactions cannot be deleted.** `Transaction.category` becomes `onDelete: Restrict` (migration `restrict_category_delete`), the service maps `P2003` of the delete to `409 Category has transactions and cannot be deleted`, again with no count beforehand. Without transactions the delete is a `204`. To free a category, its transactions are moved to another category or cleared (`PATCH` of a transaction, T16).
- This changes the category rule of ADR 0004; the rest of 0004 stands.

## Alternatives considered

- **Case-insensitive unique index on `lower(name)`** – Prisma cannot express it, so it would be hand-written SQL in a migration like the CHECK constraints, invisible in the schema, and Prisma would report the violation the same way, so nothing gets simpler.
- **`citext` column** – a Postgres extension and a column type outside what Prisma models; solves a problem the single user does not have yet.
- **Lower-casing names on write** – loses how the user wrote the name.
- **Checking the name or the transactions in the service before writing** – a race between the check and the write, and an extra query; the constraint has to be there anyway.
- **Keep `SetNull`** – the original M0 rule; rejected for the silent, irreversible change of history described above.
- **`Cascade` from the category to its transactions** – deletes money movements together with a label.
- **Delete with a target category (`DELETE …?moveTo=`)** – the friendly version of `Restrict`; a later extension, out of the MVP.
- **Archiving a category instead of deleting it** – a new column and a filter in every query; out of the MVP.

## Consequences

- `Food` and `food` can exist side by side and the dashboard shows them apart. A later switch to case-insensitive names needs a migration that merges collisions.
- Deleting a used category takes reassigning each of its transactions until a bulk operation exists. The `409` does not say how many transactions hold it; listing them by category is T17.
- Deleting a category never changes the numbers of past periods.
- Both foreign keys of `Transaction` are now `Restrict`, so cleanup scripts and tests delete transactions before categories and accounts. The same is true for deleting a `User`: the cascade to the accounts already stops at `Transaction.account` when the user has any transaction (found while verifying T15, not changed here).
- With workspaces the unique constraint becomes `(tenantId, name)` (ADR [0012](./0012-ownership-layer.md)); the semantics stay.
