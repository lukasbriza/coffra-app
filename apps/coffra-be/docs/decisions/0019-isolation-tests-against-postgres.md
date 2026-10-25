# 0019 – User isolation and database behaviour tested through HTTP against a real Postgres

- **Status:** Accepted
- **Date:** 2026-10-24

## Context

The ownership layer (ADR [0012](./0012-ownership-layer.md)) puts the owner scope into every query, so whether a user can see or change the rows of another user is decided by the filter Postgres runs. Constraints:

- The unit specs of the services mock Prisma. They pin the `where` a service builds, which is the very expression the spec repeats; they cannot show that the query as Prisma composes it (the scope through the account as a `LEFT JOIN`, the keyset of the list, the grouped sums of a balance) returns only rows of the owner.
- An in-memory fake of Prisma would have to reimplement exactly that semantics: relation filters, the `AND`/`OR` of the keyset, `groupBy` with decimal sums, `createManyAndReturn`, batch transactions, unique and foreign key errors. A spec on it would prove the fake, and an upgrade of Prisma would not show.
- Some behaviour of the driver adapter (`@prisma/adapter-pg`) had only been checked by hand: a calendar day in a `DATE` column under any time zone of the server, sums beyond the 20 digits of the default `Prisma.Decimal`, both sides of a transfer written by one statement or one transaction.
- The default test run must need neither Docker nor a `.env` file, and the machine the suite runs on stalls under many parallel loopback connections.

## Decision

- **A separate suite**, `pnpm test:integration` (`test/integration/vitest.config.mjs`), not part of `pnpm test`: the `unit` project excludes `test/integration/**`.
- **The real app:** `AppModule` with `configureApp` and the global guard line of `main.ts`, and the real `PrismaService`. Nothing in the chain guard → `@CurrentOwner()` → controller → service → `OwnershipService` → Prisma → Postgres is replaced. Access tokens come from `AuthTokensService`; the OIDC login itself is proven by the e2e specs against the fake identity provider.
- **A throwaway database** on a Postgres server (locally the dev compose server, in CI a service container), named by `TEST_DATABASE_URL`, by default database `coffra_test` on the dev server. The global setup drops and creates it, applies the migrations with `prisma migrate deploy` (so every run also proves the migrations on an empty database) and drops it at the end. A database whose name does not start with `coffra_test` is refused before anything is dropped or truncated; the suite does not read `.env`.
- **The same data for two users** in every test: `TRUNCATE` of all tables, then the same accounts, categories, transactions and transfer for both, written straight through Prisma, the amounts of the second a thousand times those of the first. Files run one at a time in one worker; requests are sequential, except in the specs of concurrent writes (two at once).
- **Rules of an isolation spec:** a request with an id of the other user answers exactly what the same request with an id nobody has answers (status and body) and writes nothing (all tables are compared before and after); every case has a control that succeeds for the owner with the same data; an error in the log (an unexpected `500`) fails the test.
- **Where another status would reveal a foreign row**, the spec says so explicitly: deleting a foreign account or category that has transactions is a `404`, not the `409` its owner gets; so is a foreign side of a transfer, a foreign account in another currency, a foreign empty account (not `204`). A foreign transaction or transfer moved to an own account in another currency, or a foreign transfer moved onto its own source account, is a `404`, never the `409` the domain rule would give: the rule may only run on a row the scoped read found. A category name another user has is a `201`, not a `409`.
- **Every protected route is covered:** `route-coverage.spec.ts` lists the protected routes through the router and requires a `describe('<METHOD> <path>', …)` in an isolation spec for each. `GET /api/users/me` is the one listed exception: it returns the caller, nothing of an owner.
- **The database behaviour mocks cannot prove** lives in the same suite: calendar days through the adapter with the server at UTC+14 and UTC−11, `asOf` and "today in UTC" through a real `DATE`, a balance of 21 significant digits, both sides of a transfer written whole or not at all (one side is made to fail on its foreign key), concurrent writes of one transfer.

## Alternatives considered

- **A mocked `PrismaService`** – repeats the filter it should test.
- **Extending the in-memory fake of the e2e specs** – reimplements Prisma; the fake would be what is tested.
- **Testcontainers** – self-contained, but a new dependency with a large tree and a container start per run, while the compose server already exists and CI offers service containers.
- **`pg-mem` or SQLite** – not the database the app runs on.
- **A transaction rolled back after every test** – the app has its own connection pool, and the specs of atomic and concurrent writes need real commits.
- **The dev database** – the suite truncates every table.
- **Calling the services with an `Owner`** – faster, but leaves out the guard, `@CurrentOwner()` and the controllers.
- **Seeding through the API** – exercises the creates, but costs many more requests per test; the controls show that the services work with the seeded rows.

## Consequences

- `pnpm test:integration` needs a running Postgres (`pnpm infra:up` locally); CI needs a Postgres service and `TEST_DATABASE_URL`.
- A forgotten owner scope on a read, a reference check, a list or a scoped delete fails the suite; this was checked by removing each scope in turn.
- The second scope on a write that follows a scoped read (update and delete of accounts and categories, update and delete of a transaction, the two updates of a transfer) and the scope of the balance aggregation (it only gets ids of accounts already read through the scope) cannot be observed through the API: the read before answers `404`, and the owner of a row never changes. They stay as defence in depth and are pinned by the unit specs of the services.
- A new protected route fails the coverage spec until it gets an isolation spec or a deliberate entry in the exception list.
- Any new path that writes or reads owned rows (the dashboard, a seed) belongs in this suite too, with the same rules.
