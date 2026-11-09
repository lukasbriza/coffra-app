# 0029 – Users delete their own account; each domain erases its data through a port in core

- **Status:** Accepted
- **Date:** 2026-11-04

## Context

A user with a single transaction could not be deleted. `User` → `Account` and `User` → `Category` are `Cascade`, but
both foreign keys of `Transaction` (`account`, `category`) are `Restrict` on purpose (ADR
[0004](./0004-ownership-through-account.md), [0014](./0014-category-names-and-delete.md)): they stop a delete of an
account or a category that still has transactions. So `DELETE FROM "User"` failed on `Transaction_accountId_fkey`, and
nothing in the app deleted users at all. What shapes the solution:

- The deletion is a function for the user ("delete my account"), not a tool of the operator.
- `core` must not touch the models of another domain and imports none (ADR [0001](./0001-modular-monolith.md)); the
  dependency direction is `core` ← `transactions`. The `User` row is a model of `core`, the accounts, categories and
  transactions are models of `transactions`. More domains with data of an owner are planned (investments).
- The only relations between the schemas of domains are foreign keys to `User` (and later `tenantId`), so the data of
  one domain never refers to the data of another.
- The tokens are stateless (ADR [0006](./0006-stateless-jwt-session.md), [0010](./0010-token-delivery-and-logout.md)):
  the server cannot end a session, a refresh only checks that the user still exists.
- The identity lives at the identity provider. The app finds a user by `(oidc, sub)` and creates one on the first
  login.
- The OpenAPI document is version 3.0, whose consumers ignore a request body on a `DELETE`; RFC 9110 gives such a body
  no meaning either.
- A stolen access token can already destroy all the data of its user through the existing routes (delete the
  transactions and transfers, then the accounts and categories).

## Decision

- **`POST /api/users/me/deletion` with `{ "confirm": "<email of the user>" }`, answered `204`.** A protected route:
  the user comes from the access token, never from the body. Not `DELETE /api/users/me` with a body (see Context), not
  a confirmation in a header (a custom header needs a CORS change and is awkward for every client).
- **The confirmation is the stored email, compared exactly** (letter case and spaces included; the client reads it from
  `GET /api/users/me`). It stops an accidental call and the deletion of another account than the client shows. A
  missing or malformed `confirm` is a `400`; a well-formed one that is not the stored email is a `409` (the request
  conflicts with what is stored, ADR [0015](./0015-income-and-expense-transactions.md)); nothing is deleted either way.
  No step-up authentication (a fresh login with `auth_time`): a stolen access token deletes the data without this route,
  so it would protect only the empty `User` row and would change the tokens of ADR 0010.
- **`core` orchestrates, each domain erases its own data through a port.** `core/users` holds
  `UserDeletionService`, the port `OwnerDataEraserInterface` (`eraseOwnerData(owner, tx)`) and the decorator
  `@OwnerDataEraser()` (`DiscoveryService.createDecorator()`). A domain that keeps data of an owner provides one class
  that implements the port and carries the decorator; `transactions` has `TransactionsDataEraser` (transactions, then
  accounts and categories, each query in the owner scope, writing only through the transaction it is handed).
  `UserDeletionService` finds the erasers through `DiscoveryService` when the module starts and refuses to start if a
  marked provider does not implement the port. `core` imports no domain.
- **One interactive database transaction, 30 seconds** (`USER_DELETION_TIMEOUT_MS`; the default 5 s of Prisma is too
  short for a large ledger): read the user, compare the confirmation, run the erasers one after another on the same
  transaction (`OwnershipService.ownerOf(userId)` builds their owner), delete the `User` row last with `delete` (a user
  gone in between fails and rolls back). The erasers delete explicitly, not through the cascade, so every query carries
  the owner scope. The `Restrict` of both foreign keys of `Transaction` stays.
- **A user who no longer exists** (deleted while the access token still works) gets the `401` of `GET /api/users/me`
  and of a refresh.
- **A failure half way is a `500` and deletes nothing.** A foreign key violation there means a row still refers to data
  of the user (a row of another user the API never writes, or a write racing with the deletion); it is not mapped, so a
  damaged database shows in the log.
- **The session ends on its own.** The refresh token is refused at once; the access token passes the guard until it
  expires (`JWT_ACCESS_TTL_SECONDS`) but finds nothing and creates nothing. The answer carries no `endSessionUrl`
  (`UsersModule` cannot depend on `AuthModule`, which depends on it): after the `204` the client drops the tokens and
  logs out at the identity provider (`POST /api/auth/logout`).
- **The identity at the provider stays.** The next login creates a new, empty user with a new id. Locking someone out is
  done at the identity provider.

## Alternatives considered

- **A command of the operator** (`node build/…/user-delete.js <sub>`, run from the image) – the deletion is meant for
  the user; a command also needs the whole environment of the app and a place in the image.
- **Orchestration in `transactions`, the route there on the path `users/me/…`** – the path of the users would be served
  by two domains, `UsersService` would be exported to other domains, and the next domain with data of an owner would
  force the orchestration to move anyway (`transactions` cannot import a domain that depends on it).
- **Registration of the erasers by hand** (a registry in `core` that each domain calls in `onModuleInit`, or a dynamic
  `CoreModule.forRoot({ erasers })` in `AppModule`) – as explicit as the decorator, but more code in each domain or a
  `CoreModule` that every test has to configure. Discovery is the mechanism Nest offers for "every provider marked X".
- **`Cascade` on `Transaction.account` and `Transaction.category`** – the delete of a user would be one statement, but a
  delete of an account or a category would silently take its transactions with it, which ADR 0004 and 0014 refuse.
- **Deleting through the cascade from `User`** (erase the transactions, let the user take the accounts and categories)
  – fewer queries, but two of the three deletes would carry no owner scope and the domain would depend on the cascade of
  a schema of `core`.
- **Soft delete or a grace period** – a way back, but every query would have to skip deleted users and the data would
  stay; out of proportion for a single-user app with a database backup.
- **Step-up authentication** – see Decision.
- **`DELETE /api/users/me` that is idempotent (`204` for a user already gone)** – the token of a deleted user answers
  `401` everywhere else; one more special case for the client.

## Consequences

- A new domain that keeps data of an owner adds an eraser (a class with `@OwnerDataEraser()` in a module of the app) and
  the spec that lists the erasers of the app. Without one, deleting a user with such data fails on its foreign key to
  `User` (or the cascade removes the rows): the database never keeps an orphan.
- The erasers run in an order that does not matter, because the data of two domains never refer to each other. If that
  rule changes, the order has to be decided.
- Deleting is final: no grace period, no export. The client says so before it asks for the email; a backup of the
  database is the only way back.
- A client that skips the logout after the `204` is signed in again without a password by the session at the identity
  provider, into a new, empty account.
- A write of the same user that races with the deletion makes it fail (a `500`, nothing deleted); a retry succeeds.
- With shared workspaces `ownerOf` returns the personal workspace of the user; what happens to shared workspaces and to
  the rows the user wrote there is a decision of its own then.
- The route is under the global rate limit like any other.
