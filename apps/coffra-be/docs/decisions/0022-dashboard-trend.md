# 0022 – Dashboard trend: totals by day, folded into months by the dashboard

- **Status:** Accepted
- **Date:** 2026-10-27

## Context

The dashboard (ADR [0021](./0021-dashboard.md)) shows what the owner earned and spent in the window, per currency and category. The same window also has to be shown month by month, so that a client can draw how income and expense moved from one month to the next.

Constraints:

- Prisma `groupBy` cannot group by a month, and cannot group by the currency of an account (ADR [0020](./0020-transaction-totals.md)). `$queryRaw` writes the owner by hand and is out (ADR [0018](./0018-account-balances.md)).
- A day is a fact about the transactions; a calendar month is a choice of the screen. The window is already made of whole UTC calendar months and worked out without `Date` (ADR 0021).
- The totals by category and the totals by month are different groupings of the same transactions, so they must cover the same days and count the same transactions: a month series that does not add up to the totals of its currency is a wrong dashboard.
- Amounts are `Money` (`Prisma.Decimal` with 40 digits), and a sum that starts from a plain `Prisma.Decimal(0)` rounds to 20 digits (ADR 0020).

## Decision

- **A second method of the totals service, `dailyTotals(owner, { from, to })`**, returns `{ currency, date, income, expense }` per currency and day, `date` as `YYYY-MM-DD`, ordered by currency, then by day. A day without a transaction has no row. Transfers and the opening balance never count, and a planned transaction counts when its day is in the range, as for `categoryTotals`.
- **One filter for both aggregations.** The owner scope through the account, `type in (income, expense)` and the two bounds of the range are written once (`incomeExpenseWhere`) and used by both `groupBy` calls, so a new sum cannot forget the scope or count a transfer.
- **Two reads.** One `groupBy` by `(accountId, type, date)` with `_sum.amount`, then the currencies of the accounts the sums refer to, read after the sums for the reason given in ADR 0020. No category is read. The days of accounts in one currency are added in `Money`. `date` comes back from the `DATE` column as midnight UTC and is written with `formatIsoDate`, never with a local getter.
- **The dashboard folds the days into months** and gives every currency a `trend`: one entry per calendar month of the window, oldest first, `{ month: 'YYYY-MM', income, expense, net }`. The month of a day is the first seven characters of its date. A month without a transaction is in the series with zeros, so the series has exactly as many entries as the period covers (3, 6 or 12) and a client never fills gaps.
- **The months add up to the totals of the currency**, income and expense each, because both figures read the same days.
- **The window is worked out once** and both figures are asked for exactly the same days, at once.
- **The currencies of the answer are those of the totals by category.** The days of any other currency are left out of the trend, and a currency without a day has zeros in every month. A day that falls in none of the months is a fault (`Error`), not a client error: the service only returns the days it was asked for.
- **No new index.** The aggregation uses the same index as the totals by category (ADR 0020). Measured on Postgres 17 with Prisma 7.8, medians of 7 runs through Prisma, two currencies, three accounts:

  | Rows                  | Window   | Day rows returned | `dailyTotals` alone | Whole dashboard |
  | --------------------- | -------- | ----------------- | ------------------- | --------------- |
  | 25 thousand, one user | 3 months | 184               | 6.2 ms              | 9.7 ms          |
  | 25 thousand, one user | 6 months | 368               | 9.3 ms              | 10.5 ms         |
  | 25 thousand, one user | 1 year   | 730               | 15.8 ms             | 17.2 ms         |
  | 2 million, 100 users  | 3 months | 184               | 7.8 ms              | 9.4 ms          |
  | 2 million, 100 users  | 6 months | 368               | 13.3 ms             | 13.9 ms         |
  | 2 million, 100 users  | 1 year   | 730               | 23.0 ms             | 22.1 ms         |

  The two columns are medians of separate runs, so the whole dashboard can come out a little under its part. The categories and the days are read at once, so the dashboard costs about as much as the slower of the two.

  On 2 million rows the planner starts from the accounts of the owner and reads `(accountId, date, createdAt, id)` with a bitmap heap scan, filtering the type on the heap, then hash-aggregates 9,855 rows into 1,095 groups (16.7 ms for the one-year statement). The months and the totals equal an independent SQL (`date_trunc('month', date)`, `SUM … FILTER`) for every period, with the server in UTC, UTC+14 and UTC−11.

## Alternatives considered

- **The service returns months (`monthlyTotals`)** – a month is how one screen groups time; a second consumer that wants weeks or a different start of the month would have to undo it. A day is a fact about the transactions, and the folding is a few lines over rows that are already added up.
- **One aggregation by account, category, type and day that feeds both figures** – one read and a consistent snapshot, but the number of rows is multiplied by the number of categories (up to a year × accounts × categories × 2), and `categoryTotals` would no longer be what the other consumers rely on.
- **Raw SQL with `date_trunc` and the currency in one statement** – the owner would be written by hand into the `WHERE`, which the type-level scope of the ownership layer does not cover (the reason of ADR 0018 and ADR 0020).
- **A series of the months that have a transaction only** – the length of the series would depend on the data and every client would fill the gaps itself the same way.
- **The currencies taken from the days** – the two figures of one answer could then name different currencies; the totals by category decide, as they do everywhere else on the dashboard.
- **Each figure works out its own window** – around midnight at the end of a month the two reads could be given different months and the series would no longer add up.

## Consequences

- The two figures are two reads, not one snapshot. A transaction written between them is in one and not in the other: a month series can then differ from the total of its currency by that transaction, and a new currency can appear in only one of them (left out of the trend, or shown with zeros). The same kind of gap exists inside `categoryTotals` (ADR 0020) and does not matter for one owner entering data by hand.
- The currencies of the owner's accounts are read once per call, twice for a dashboard. It is one query by id over a few rows.
- A new figure over time (weeks, a rolling average) is another way of folding the same days in the dashboard, not another aggregation.
- A month is a UTC month, like every date in the API. A client east of UTC sees the previous month between its own midnight and UTC midnight on the first, as it does for the window and the balance.
- The cost grows with the days of the window that have a transaction, not with the number of transactions: a window of years, or an owner with many accounts, is a reason to measure again.
- A spec of the trend needs amounts of more than 20 digits inside one month, a day on each side of a month change (including 29 February and December to January), and the server in the extreme time zones.
