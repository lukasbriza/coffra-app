# 0017 – Transfers: one resource over the pair, atomic writes, what a change may touch

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

ADR [0003](./0003-transfer-as-paired-rows.md) stores a transfer as two `Transaction` rows (`out` on the source account, `in` on the target) sharing a `transferPairId`, created, changed and deleted together. It does not say what the API calls a transfer, what a change may touch, how "together" is achieved, or which status codes apply. Since ADR [0015](./0015-income-and-expense-transactions.md) a side of a transfer is read-only in `/api/transactions`, so transfers need an API of their own.

What the database enforces and what it does not:

- It does: the shape of a side (CHECK `transfer_shape`: a pair id and a direction, no category), one `out` and one `in` per pair at most (unique `(transferPairId, transferDirection)`), `amount > 0`, existing accounts (`Restrict`).
- It does not: that both sides exist, that they carry the same amount, date and note, that both accounts belong to one owner (ADR [0004](./0004-ownership-through-account.md)), that both are in one currency (ADR [0005](./0005-money-and-currency.md)), or that the two accounts differ.

## Decision

- **A transfer is a resource of its own, `/api/transfers`, with writes only:** `POST /api/transfers`, `PATCH /api/transfers/:pairId`, `DELETE /api/transfers/:pairId`. Its id is the `transferPairId` of both sides, called `pairId` in the path and in the response. There is no `GET`: both sides, each with its `transferPairId` and `transferDirection`, come from `GET /api/transactions`, and every write returns the whole transfer.
- **The response is the pair as one object:** `{ pairId, fromAccountId, toAccountId, amount, date, note }`. No ids of the sides.
- **One amount, one date, one note per transfer**, stored on both sides alike. Every write sets them on both.
- **A transfer never has a category.** `categoryId` in the body of `POST` or `PATCH` is a `400` with any value, `null` included (`a transfer has no category`), instead of being dropped silently by the global `whitelist`. The service never puts a category into `data`; CHECK `transfer_shape` is the last line.
- **`PATCH` may change** the amount, the date and the note (always both sides), and the accounts: `fromAccountId` moves the `out` side, `toAccountId` the `in` side, with the checks of a create. Giving both accounts swapped reverses the transfer.
- **Checks, before any write:**
  - both accounts are read through the owner scope at once (the source reported first): a foreign or missing one is `404 Account not found`, the same body as `GET /api/accounts/:id`;
  - both accounts have one currency; on `PATCH` every account a side moves to has the currency of the transfer, even when both sides move to accounts of another common currency (the amount is never converted, so it would change its meaning);
  - the two accounts differ. The account ids are lower-cased on input (`@IsAccountId()`): Postgres finds a `uuid` under any letter case, so `ABC…` and `abc…` are one account, and a plain string comparison would let a transfer from an account to itself through.
- **Status codes**, the rule of ADR 0015 applied:
  - `400` when the body alone decides: the same account on both sides in one body (also in two letter cases), a category, a malformed field;
  - `404` for an id the owner does not have: `Account not found` for an account in the body, `Transfer not found` for the `pairId`;
  - `409` when a valid body conflicts with what is stored: accounts in different currencies, and a `PATCH` whose single account meets the side that stays (`{ "toAccountId": <the current source> }` on `A → B` would make `A → A`: `409 A transfer needs two different accounts`).
- **Atomic writes:**
  - create: `createManyAndReturn` with both sides, one `INSERT … VALUES (…), (…) RETURNING`;
  - change: `$transaction([update out, update in])`, a batch in one database transaction, always `out` first; each side is addressed by the unique `(transferPairId, transferDirection)` with the owner scope;
  - delete: `deleteMany` of both sides, one `DELETE`, with no read before it: its count answers the `404`, and there is nothing else to decide.
    Verified against Postgres 17 with Prisma 7.8.0 and `@prisma/adapter-pg`: a foreign key failure of the second row of the `INSERT` and of the second `UPDATE` both end in `ROLLBACK` with nothing written; the `DELETE` with the owner scope is one statement (`EXISTS` on `Account`).
- **The pair is read as a whole:** anything but one `out` and one `in` of the same pair is an error of the data (a `500` in the log), never a `404`. The API cannot produce one.
- **`transferPairId` is made by the application** (`randomUUID()`, UUID v4), as the other ids are.

## Alternatives considered

- **Changing a side through `/api/transactions/:id`**, the other side following – two APIs for one thing, and a request that names one row would change another one out of sight.
- **The id of the `out` row as the id of the transfer** – it would depend on the direction, and a swap of the accounts would change it.
- **`GET /api/transfers/:pairId` and a list of transfers** – the list of transactions already returns both sides with the pair; left out until a client needs it, can be added without changing anything else.
- **Two `create` calls in one `$transaction`** – the same guarantee, four round trips to the database instead of one.
- **An interactive transaction with `SELECT … FOR UPDATE`** – it would lock for values that never change (the owner and the currency of an account); a change of existence between the check and the write is caught by the database (`P2003`, `P2025`).
- **Accounts that cannot change** (delete and create again) – a typo in an account would cost a new transfer, unlike a transaction, which can move (ADR 0015).
- **`400` for the same account after the merge in a `PATCH`** – one status for one kind of mistake, but the body alone is valid; only the stored side makes it wrong.
- **Dropping `categoryId` silently** – the client would believe the transfer has a category.
- **A transfer between currencies** (two amounts and a rate) – ADR 0005, not in the MVP.

## Consequences

- A transfer changes only through `/api/transfers` and is read only through `/api/transactions`. A client that edits a transfer puts it together from the two sides of the list (same `transferPairId`; the direction says which side is the source).
- That both sides carry the same amount, date and note is held by the service alone. Every other path that writes transfers (a seed, bank sync, a manual fix) must write both sides in one statement or one database transaction, or the pair breaks without the database noticing.
- Moving a side changes the balances of two accounts, both computed from the database. An account with a side of a transfer cannot be deleted (`Restrict`, `409`) until the transfer is deleted.
- Atomicity rests on how Prisma builds the SQL (a single `INSERT`, a batch transaction, a single `DELETE`). An upgrade of Prisma or of the driver adapter can change that; a mock cannot see it, so it belongs in a database test suite.
- Two `PATCH` of one transfer at once lock the sides in the same order (`out`, then `in`): the second waits, nothing deadlocks, and the transfer ends with every field from one request on both sides.
- The `400` for one account on both sides and the `409` for the same result reached through the stored side differ on purpose; the Swagger descriptions say both.
