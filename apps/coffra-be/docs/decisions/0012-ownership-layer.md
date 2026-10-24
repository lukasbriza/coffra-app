# 0012 – Ownership layer: owner scope in the query, foreign equals missing

- **Status:** Accepted
- **Date:** 2026-10-05

## Context

ADR [0004](./0004-ownership-through-account.md) put the ownership check in one place instead of scattered `WHERE userId = …` clauses, so that a later move to shared workspaces is a schema migration plus one place in the code. The layer has to live in `core`, which must not know the models of `transactions` (ADR [0001](./0001-modular-monolith.md)), so it cannot run the queries itself. `Transaction` has no `userId` and is owned through its account. The API must not reveal whether an id of another user exists. The guard (ADR [0011](./0011-global-jwt-guard.md)) only puts `{ userId }` on the request and never touches the database.

## Decision

- **Scope in the query, not a check after loading.** `OwnershipService` (`core/ownership`) runs no query. It hands out pieces the domain spreads into its own Prisma calls:
  - `scope(owner)` goes into the `where` of every query on a model with owner columns (`Account`, `Category`), including writes; a child model is scoped through its parent (`{ account: ownership.scope(owner) }` for `Transaction`);
  - `ownerData(owner)` goes into the `data` of a create;
  - `orNotFound(row, 'Account')` turns the `null` of a scoped read into `404 Account not found`.
- **Foreign equals missing, `404` not `403`.** A scoped query never finds a row of another owner, so "does not exist" and "is not yours" are indistinguishable to the query and end on the same path with the same body. RFC 9110 15.5.5 allows a `404` for a resource the server will not disclose.
- **`Owner` is opaque.** Domain services take an `Owner` (from `@CurrentOwner()`), not a `userId`, and never read its fields. Today it is `{ userId }`; with workspaces it becomes `{ userId, workspaceId }` without changing a service signature. `@CurrentUser()` stays for the identity of the caller (`GET /api/users/me`), `@CurrentOwner()` is for data.
- **One owner per request.** The scope is a single owner, never `tenantId IN (all memberships)`. Checking that an account and a category belong to the same owner relies on it: both are read through the same scope. A workspace version must keep this invariant.
- **A service, not free functions.** It has no dependencies today, but domains inject it (`@Inject(OwnershipService)`), so when it needs the database (memberships, roles) the domain constructors stay the same. `OwnershipModule` is exported from the `core` barrel on its own, so a domain module imports it without booting `AuthModule`.
- **Nullable `tenantId` on `Account` and `Category`** (UUID, no foreign key, no index, no `Tenant` table). Always `NULL` in the MVP: nothing writes or reads it and no DTO exposes it. `Transaction` does not get one, it inherits the owner from its account.

## Alternatives considered

- **Check the row after loading / a registry of resolvers (`assertOwned('account', id)`)** – two queries per access, does not work for lists (the filter has to be in the query), a second place that knows the owner column, and `core` would have to know the domain models.
- **Prisma client extension with `AsyncLocalStorage`** – filters automatically, but it is hidden magic, `core` would have to name the models `account` and `category`, and a query that must not be scoped (none yet) needs an escape hatch.
- **Postgres row-level security** – the strongest guarantee, but it needs a `SET` per connection with a driver adapter and a pool, and is out of proportion for a single-user app.
- **A guard over route parameters** – has to know which model each route parameter belongs to and does nothing for lists or for ids in the body.
- **`403` for a foreign resource** – tells the caller the id exists.
- **`scope(userId)` with `@CurrentUser()`** – simpler, but "owner = user" would be baked into every service signature and the move to workspaces would touch every service and controller.

## Consequences

- A forgotten scope is a data leak: the layer does not enforce it. Review checks that every query on `account`, `category` and `transaction` spreads `ownership.scope(owner)`; `findUnique({ where: { id } })` in a domain is a red flag. Isolation tests go through the real endpoints.
- The generated Prisma types carry `tenantId: string | null`, so a Prisma row returned straight from a controller would expose it. Responses are mapped explicitly to a view type.
- A deleted user with a still valid access token (up to `JWT_ACCESS_TTL_SECONDS`) finds nothing (`404`, empty lists); a create fails on the foreign key to `User`, which the domain maps.
- **Moving to workspaces** touches the layer and migrations only:
  1. `Workspace` and `WorkspaceMember` (`userId`, `workspaceId`, role) in `core.prisma`.
  2. Backfill: a personal workspace for every user, their `Account` and `Category` rows get its id as `tenantId`.
  3. `tenantId` `NOT NULL` + foreign key to `Workspace` + index; the category unique `(userId, name)` becomes `(tenantId, name)`.
  4. `Owner` becomes `{ userId, workspaceId }`: the active workspace comes from the request (a header, the personal one by default) and the layer checks the membership in the database. That is async, so the decorator becomes a guard or interceptor in `core/ownership` that sets `request.owner`, and `@CurrentOwner()` only reads it.
  5. `scope` returns `{ tenantId }`, `ownerData` `{ tenantId, userId }` (`userId` as the author of the row, or dropped; decided then).

  Outside the layer only the migrations and the `409` message of a duplicate category change. If the workspace were chosen in the path (`/workspaces/:id/…`), the controller routes would change too, the services would not.
