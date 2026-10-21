# 0016 – Transactions list: keyset cursor over a total order, filters as predicates, two indexes on the sort key

- **Status:** Accepted
- **Date:** 2026-10-21

## Context

`GET /api/transactions` lists the transactions of the owner, both sides of a transfer included, with filters (account, category, type, a range of days), paging and an order. Four things about it are not obvious from the code and are hard to change once clients rely on them:

- **Ties.** `date` is a `DATE` without a time, so many rows share it. Without a total order Postgres returns tied rows in any order, which can change between two queries, and pages repeat or skip rows. `createdAt` does not settle it: Prisma writes it from the client with millisecond precision, so rows written within the same millisecond tie (both sides of a transfer will).
- **Paging.** Both an offset (`page`/`pageSize` with a total) and a cursor were candidates.
- **Ids in filters.** ADR [0015](./0015-income-and-expense-transactions.md) says what an id the owner does not have is in the path and in the body (`404`), not in a query filter.
- **Indexes.** The schema had no index on `date` (left open when the schema was designed, to be decided on the real queries). Prisma 7.8.0 writes the owner scope through the account as `LEFT JOIN "Account" AS "j0" … WHERE "j0"."userId" = $1`, and has no comparison of row values (`(a, b, c) < (x, y, z)`).

## Decision

- **A total order:** `(date, createdAt, id)`, `order=desc` (the default, newest first) or `asc`, which flips all three keys and is exactly the reverse.
- **Keyset paging, no offset:** `limit` (1–100, default 50) and `cursor`; the response is `{ items, nextCursor }`, `nextCursor` is `null` on the last page, there is no total. The query reads `limit + 1` rows: when the extra row comes, there is a next page, and the cursor is made from the last row **returned**, not from the extra one. The rows beyond a cursor of a `desc` list are `date <= d AND (date < d OR createdAt < c OR (createdAt = c AND id < i))` (the mirror for `asc`); the bound on `date` alone adds nothing to the result but gives the planner a range. It sits in `AND`, so it never replaces the `from`/`to` filter on the same column.
- **The cursor carries values, not a reference:** base64url of JSON `{ order, date, createdAt, id }`. Nothing is ever looked up by its `id`, so a deleted row still marks a position and an id of another owner reveals nothing. It is not signed: a changed cursor only moves the position within the rows of the owner, whose scope is in every query. It is bound to `order` (a cursor of the other direction is a `400`, it would point to the rows on the other side) but not to the filters (the position still means something; a client starts again when it changes them). It is decoded strictly (at most 256 characters, base64url, exactly the four keys, a day that exists, the timestamp as `toISOString()` writes it, a UUID); anything else is a `400`.
- **`createdAt` is compared by equality,** which holds only because `@prisma/adapter-pg` writes and reads `TIMESTAMP(3)` in UTC to the millisecond. Verified against Postgres with the process in UTC, UTC+14 and UTC−11: a row written in any of them is found by equality and by `lt`/`gt` of 1 ms in any other.
- **Filters are predicates, not references.** An account or a category of another owner, or one that does not exist, matches nothing: `200` with an empty page, the same body for both, and no query beyond the list. This extends the status rule of ADR 0015: an id in a list filter is not a reference, because nothing is written against it and "no row matches" is the true answer.
- **A range of days** is inclusive at both ends: `from` and `to` through `@IsIsoDate()`, `to` not before `from` (`@IsNotBefore('from')`, a `400`), `date <= to` at midnight UTC keeps the whole day because the column is a `DATE`.
- **The query string is parsed strictly:** `limit` is the plain spelling of a whole number (`@IsQueryInteger()`: no `1e2`, `0x10`, spaces or leading zeros), a repeated parameter is a list and a `400`. An unknown parameter is dropped by the global `whitelist`, as an unknown field of a body is, so a misspelt filter lists unfiltered.
- **Indexes:** `(accountId, date, createdAt, id)` replaces `(accountId)`, and `(date, createdAt, id)` is added. The first reads a page of one account in index order and still serves every lookup by account (the foreign key, balances); the second reads a page of all accounts in index order, which is the default view. Migration `transaction_list_indexes`.

Measured with `EXPLAIN (ANALYZE, BUFFERS)` on the SQL Prisma 7.8.0 writes for the real `TransactionsService.list` (and a `groupBy` like the dashboard will need), Postgres 17.5, median of five runs in ms. _Realistic_: one user, 6 accounts, 30 categories, 25,000 transactions over ten years (5 % transfer rows in pairs, up to 19 rows a day). _Stress_: the same user among 100 users, 2,005,000 rows.

| Query                      | A real | CD real | A stress | B stress | C stress | D stress | CD stress |
| -------------------------- | -----: | ------: | -------: | -------: | -------: | -------: | --------: |
| first page, all accounts   |  11.72 |    0.12 |    87.30 |    88.35 |    95.65 |     4.09 |      4.05 |
| cursor five years back     |   7.35 |    0.19 |    11.59 |     8.43 |     8.44 |     4.97 |      4.97 |
| first page of one account  |   2.56 |    0.15 |     2.83 |     0.21 |     0.15 |    12.30 |      0.19 |
| one account, cursor back   |   1.92 |    0.17 |     2.02 |     0.21 |     0.17 |    29.99 |      0.19 |
| one account and a month    |   1.03 |    0.21 |     1.31 |     0.22 |     0.23 |     2.19 |      0.16 |
| a month, all accounts      |   1.45 |    0.18 |    47.67 |     0.60 |     0.53 |    12.90 |      0.63 |
| a category and a year      |   0.55 |    0.42 |     1.99 |     0.79 |     0.93 |     1.79 |      1.02 |
| sum by category, one month |   1.51 |    0.51 |     4.85 |     0.49 |     0.47 |    11.80 |      0.58 |
| sum by category, one year  |   2.74 |    2.11 |     7.40 |     2.79 |     2.75 |   101.53 |      3.18 |

A: the indexes before (`(accountId)`). B: `(accountId, date)` instead. C: `(accountId, date, createdAt, id)` instead. D: A plus `(date, createdAt, id)`. CD: C plus `(date, createdAt, id)`, the decision. At 2 million rows the two indexes take 129 MB and 95 MB next to a 222 MB table; at 25,000 rows about a hundredth of that.

## Alternatives considered

- **Offset `page`/`pageSize` with a total** (the first proposal) – a page number and a count for the UI, but a write between two pages shifts the rows by one (a row repeats or is skipped), and a deep `OFFSET` reads every row before it.
- **The `cursor: { id }` of Prisma** – looks the cursor row up by `id` without the owner scope: an id of another owner would position the page by that row (revealing that it exists and its date), and a deleted cursor row ends the list with an empty page.
- **A signed cursor (HMAC)** – protects nothing: a changed cursor only moves within the rows of the owner.
- **A cursor not bound to `order`** – with the other direction it would silently return the rows on the other side of the position.
- **`404` for a foreign id in a filter** – an extra query, a race with a delete, and a saved filter of a deleted account would become an error.
- **Order by `(date, id)` only** – the order within a day would be random (`id` is a UUID v4).
- **`(accountId, date)` (B) or the full key behind the account (C) alone** – one index, fast for one account, a range and the sums, but the default view (all accounts) stays a scan and sort of every row of the owner: 12 ms at 25,000 rows, about 90 ms in the stress set.
- **`(date, createdAt, id)` alone (D)** – the default view is fast, but the planner then reads it for one account too and filters (12–30 ms) and the yearly sum takes 101 ms.
- **`forbidNonWhitelisted`** – would refuse a misspelt filter, but only as a global switch that changes every body of the API; a pipe on the route runs after the global one, which has already dropped the unknown keys.
- **`@Type(() => Number)` for `limit`** – `Number()` accepts `1e2`, `0x10`, `" 2 "` and `""` (as 0).

## Consequences

- No total and no jump to a page; going back means the client keeps the cursors it got. A total can be added later as a `count` with the same filters, without changing the cursor.
- A `PATCH` that moves the date of a row across the position shows it twice or not at all during one walk through the list; any other write between two pages changes nothing for the rows already passed.
- Changing the sort key invalidates every issued cursor (a `400`, the client starts again).
- Every write maintains one index more than before, and a wider one behind the account; negligible for one user writing by hand.
- In a table shared by many owners, the default view reads the date index from the top and skips the rows of other owners until it has `limit + 1` rows of its own (about 5,400 buffers for 100 users). An owner with few rows among very many others would read far; with workspaces, measure again.
- The balances and the sums by period of the dashboard can rely on the index behind the account; the dashboard also reuses `@IsNotBefore()`. Isolation tests through the database have to prove the isolation of the list through the database: no foreign rows unfiltered, a filter on a foreign account or category, a cursor built from the values of a foreign row.
- An upgrade of Prisma or of the driver adapter can change both the SQL of the scope (a join today) and how `TIMESTAMP` travels; measure and verify again then.
