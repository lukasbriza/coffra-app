# 0018 – Account balance computed on read from grouped sums, up to a day

- **Status:** Accepted
- **Date:** 2026-10-22

## Context

ADR [0013](./0013-opening-balance-and-fixed-currency.md) defines the balance of an account as `openingBalance` + income + transfer `in` − expense − transfer `out`, and says the opening balance is not a transaction. It does not say where that number is computed, which transactions count, or what a client sends to get it.

Constraints:

- Every query on `Transaction` carries the owner scope through the account (ADR [0012](./0012-ownership-layer.md)); a query that writes the owner by hand is the red flag the ownership layer exists to prevent.
- Amounts are decimal strings and never floating point (ADR [0005](./0005-money-and-currency.md)); the sum of many amounts can exceed what a column holds.
- A list of accounts must not cost a query per account, and rows must not be loaded to be added up.
- Dates are calendar days in UTC everywhere in the API; `Transaction.date` is a `DATE`.
- A transaction can be entered with a date in the future (a planned payment). The balance is meant to be what the account holds, which a payment that has not happened yet does not change.

## Decision

- **Every response that returns an account carries `balance`**: a decimal string with four decimal places, in the currency of the account, next to `openingBalance`. One shape for create, read and update.
- **It is computed on read, not stored.** One `groupBy` over `Transaction` by `(accountId, type, transferDirection)` with `_sum.amount`: at most four sums per account, one statement. The application starts from the opening balance and adds income and incoming transfers and subtracts expenses and outgoing transfers.
- **The query keeps the owner scope** (`account: scope`) and adds `accountId in (the accounts just read)`. The ids only narrow the query for the planner; they are never what decides whose rows are counted. The list reads the accounts first, then aggregates for all of them at once (two queries however many accounts there are); a single account aggregates for itself; a new account is not aggregated at all, its balance is its opening balance.
- **The arithmetic runs in `Prisma.Decimal` with 40 significant digits.** The default of 20 rounds a sum above about 10^16 silently (twenty full amounts of the column already do).
- **Only the transactions dated up to a day count, that day included.** Without a parameter the day is today in UTC, so a transaction dated later does not change the balance until its day comes. The opening balance always counts, whatever the day. A transfer has one date on both sides, so it is never counted on one account and not on the other.
- **`GET /api/accounts` and `GET /api/accounts/:id` take an optional `asOf=YYYY-MM-DD`** (a day that exists; any day is allowed, a later one adds the planned transactions). `POST` and `PATCH` answer with the balance of today. "Today" is the UTC date of the server clock, like every date in the API; a client in another time zone that wants its own today sends `asOf`.
- **No new index.** Measured on Postgres 17 with Prisma 7.8 over the SQL it produces (`EXPLAIN ANALYZE`, medians of 7 runs through Prisma):

  | Rows                          | List of accounts | One account |
  | ----------------------------- | ---------------- | ----------- |
  | 25 thousand, one user         | 11 ms            | 4 ms        |
  | 2 million, 100 users          | 24 ms            | 8 ms        |
  | 2 million, 100 users, no `in` | 69 ms            | –           |

  Without `accountId in` the planner reads the whole table once there are many users (a parallel sequential scan); with it, the list uses the index `(accountId, date, createdAt, id)` like the detail does.

## Alternatives considered

- **A stored balance** (a column kept up to date by every write) – fast to read, but every path that writes transactions (the API, a seed, a later bank sync, a manual fix) has to maintain it atomically, drift is invisible, and it could not answer for a day or exclude planned transactions without being recomputed anyway.
- **One raw SQL statement with `CASE` and a join** – a single query, but `$queryRaw` bypasses the ownership scope: the owner would be written by hand into a `WHERE`, and the type-level guarantee that the scope fits the models would not cover it.
- **Loading the rows, or `include: { transactions }`, and adding up in the application** – transfers every row of the account for one number.
- **A separate `GET /api/accounts/:id/balance`** – the list would need a call per account.
- **Counting every transaction whatever its date** – simplest, but a planned payment would lower the balance weeks before it happens.
- **Always today, no `asOf`** – a client away from UTC would have no way to fix the hours around midnight, and no way to ask what the balance will be.
- **A time zone setting on the server** (a new environment variable) – solves the same window for one place, adds configuration and a validated variable for a single user; the client already knows its own date.
- **A materialized view or a trigger** – the maintenance problem of a stored balance with more moving parts.
- **A covering index** `(accountId, date) INCLUDE (type, transferDirection, amount)` – Prisma cannot express `INCLUDE` in the schema, so it would be a hand-written migration, for a gain the measurements do not call for.

## Consequences

- Nothing maintains the balance: a new way of writing transactions changes it without touching anything else. The price is an aggregation on every read of an account, including the answer to `PATCH`, proportional to the rows of the account up to the day.
- The balance can change without any write: at midnight UTC a transaction dated tomorrow becomes part of it. Anything that caches a balance must take that into account.
- Between midnight UTC and the local midnight of a client east of UTC (01:00 or 02:00 in Central Europe), a transaction dated today is not counted yet unless the client sends `asOf`; for a client west of UTC the balance already includes a day that has not begun for it.
- The plan of the query depends on `accountId in`. A change of the query, an upgrade of Prisma or of the driver adapter, or accounts several orders of magnitude larger is a reason to measure again; the covering index above is the next step, as a hand-written migration.
- The balance is a computed value: it can fall outside the range of `Decimal(19,4)` (a sum of many full amounts), and it is not the sum of the transactions of the account (ADR 0013). A correction of `openingBalance` moves it over the whole history.
- A balance never includes the rows of another owner because the scope is in the query; the specs pin the filter, but only a suite that runs the queries against a database can show it.
