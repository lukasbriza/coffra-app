# 0001 – Modular monolith with domain modules

- **Status:** Accepted
- **Date:** 2026-10-01
- **Milestone / task:** M0, #8 (T28)

## Context

The backend starts with transactions but more areas will follow (dashboard, later investments). The
question was whether each area should be a separate package or service, with a composing backend on top.

## Decision

One Nest app (`apps/coffra-be`). A domain is a module in `src/modules/<domain>/`: `core`,
`transactions`, `dashboard`. Rules:

1. A domain exports only through its `index.ts`. Other code imports `'../<domain>'`, never `'../<domain>/…'`.
2. A domain touches only its own Prisma models (`prisma/schema/<domain>.prisma`). Foreign data comes through a public service of the other domain.
3. Dependency direction is `core` ← `transactions` ← `dashboard`.
4. The only allowed relations between schemas are foreign keys to `User`.

`config`, `health` and `prisma` are infrastructure modules, reachable from anywhere through their
`index.ts`, importing no domain. Dashboard is cross-domain by nature, so it is its own module that only
calls public services of other domains.

The boundaries are **not lint-enforced**. A `no-restricted-imports` rule was planned and deliberately
dropped in T28; they hold by discipline and review.

Extracting a domain into `packages/<domain>` is deferred until investments start. It should be
mechanical: move the folder, add a `package.json`, change imports.

## Alternatives considered

- **Domain packages + a composing app** – hard boundaries, but needs a new template/generator and package builds, and a shared Prisma client and migration history is awkward across packages.
- **Separate services, each with its own DB** – strongest isolation, but needless network and consistency cost for a single-user homelab app.

## Consequences

- One DB, one migration history, one deploy; transactions across domains are free.
- Boundary violations are caught only in review. Watch for it when adding the first cross-domain call.
- The dashboard must read through public services of `transactions`, not its tables.
