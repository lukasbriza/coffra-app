# 0002 – Prisma schema split by domain, one client

- **Status:** Accepted
- **Date:** 2026-10-01
- **Milestone / task:** M0, #1 (T1), #2 (T2)

## Context

Domains are separate modules ([0001](./0001-modular-monolith.md)), but Prisma generates one client from
one datasource and keeps one migration history.

## Decision

The schema is a folder, `prisma/schema/`, split by domain:

- `base.prisma` – generator (`prisma-client`, CommonJS, output `src/modules/prisma/generated`) and datasource.
- `core.prisma` – `User`, `AuthSource`.
- `transactions.prisma` – `Account`, `Category`, `Transaction` and their enums.

There is still a single Prisma client and a single migration history (`prisma/migrations`). The
connection URL is not in the schema (Prisma 7); it comes from `prisma.config.ts`, and the runtime
client gets it through the `pg` driver adapter.

## Alternatives considered

- **One `schema.prisma`** – simplest, but domains would not be visible in the schema and the boundary rules ([0001](./0001-modular-monolith.md)) would have nothing to map to.
- **A schema and client per domain** – hard separation, but separate migration histories or databases, which is not worth it for this app.

## Consequences

- The generated client contains every model, so "a domain touches only its own models" is a convention, not something the client enforces.
- A relation across domain files is allowed only as a foreign key to `User`.
- The generated client (`src/modules/prisma/generated`) is never edited by hand; run `pnpm prisma:generate` after schema changes.
