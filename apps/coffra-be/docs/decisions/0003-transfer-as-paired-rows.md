# 0003 – Transfer stored as two paired rows

- **Status:** Accepted
- **Date:** 2026-10-01
- **Milestone / task:** M0, #1 (T1), #2 (T2); service logic in T18

## Context

A transfer moves money between two own accounts. It must change both balances but must not count as
income or expense in the dashboard. Bank sync (out of the MVP) will later deliver both sides as separate
records.

## Decision

A transfer is two `Transaction` rows with `type = transfer`:

- both share one `transferPairId`;
- `transferDirection` is `out` on the source account and `in` on the target account;
- `amount` is always positive, so the direction is stored explicitly;
- the pair is created, changed and deleted together in one DB transaction;
- same currency only, no category;
- transfers are excluded from the income/expense aggregation and affect balances only.

The shape is enforced in the DB:

- `@@unique([transferPairId, transferDirection])` – a pair has at most one `out` and one `in` side;
- CHECK `amount_positive` – `amount > 0`;
- CHECK `transfer_shape` – a transfer has `transferPairId` and `transferDirection` and no `categoryId`; every other type has neither pair field.

The CHECK constraints are added by hand in the init migration because Prisma cannot express them.

## Alternatives considered

- **One row with a `targetAccountId`** – simpler to enter, but outside the original plan and it would need a migration once bank sync delivers two separate records.

## Consequences

- Balance sign: `income` and transfer `in` add, `expense` and transfer `out` subtract.
- Postgres treats NULLs as distinct in unique indexes, so income/expense rows (both pair fields NULL) never collide on the unique constraint.
- Services must validate and return 400 before a CHECK violation turns into a 500.
- The same-currency rule is a service rule; the DB does not check it.
