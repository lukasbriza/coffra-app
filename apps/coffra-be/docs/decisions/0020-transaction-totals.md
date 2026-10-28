# 0020 – Transaction totals: one service in `transactions`, rows folded per currency

- **Status:** Accepted
- **Date:** 2026-10-25

## Context

A domain reads the data of another only through a public service of that domain (ADR [0001](./0001-modular-monolith.md)). The `dashboard` needs the income and the expense of the owner over a range of days, by category and by currency, and `transactions` exported nothing but its module.

Constraints:

- Every query on `Transaction` carries the owner scope through the account (ADR [0012](./0012-ownership-layer.md)); `$queryRaw` writes the owner by hand and is out (ADR [0018](./0018-account-balances.md)).
- A currency lives on the account (ADR [0005](./0005-money-and-currency.md)), not on the transaction. Prisma `groupBy` cannot group by a field of a relation, so "by currency" cannot be asked of the database.
- A sum of many amounts can exceed the 20 significant digits of `Prisma.Decimal` (ADR 0018), and the arithmetic of the caller meets the same limit.
- A transfer only moves money between accounts, and the opening balance of an account is not a transaction (ADR [0013](./0013-opening-balance-and-fixed-currency.md)): neither is income or expense.

## Decision

- **`TransactionTotalsService`** (`transactions/totals/`) is exported through the domain barrel with its types, and `TransactionsModule` re-exports its module, so a domain that imports `TransactionsModule` can inject it. Nothing else of the domain is exported. One method, `categoryTotals(owner, { from, to })`, takes two calendar days, both inclusive.
- **It returns rows already folded per currency and category:** `{ currency, category: { id, name } | null, income, expense }`. The caller never sees an account. A transaction without a category is the row with `category: null`; the side without a transaction is `0`.
- **Three reads, whatever the number of accounts and categories.** One `groupBy` over `Transaction` by `(accountId, categoryId, type)` with `_sum.amount`, filtered by the owner scope through the account, `type in (income, expense)` and the range. Then, in parallel, the currencies of the accounts and the names of the categories the sums refer to, read by id and within the owner scope. Nothing is read when there are no sums, and the categories are not read when no sum has one.
- **The names are read after the sums, not before.** An account or a category that has a transaction cannot be deleted (`Restrict`), and an account never changes its owner or its currency, so everything a sum refers to is still there to read. A category that was created and used between two reads cannot be missed.
- **A reference that is not found is a fault, not a client error.** A sum of an account or a category that the scoped read does not return (a transaction pointing at a category of another owner would be the case) makes the call fail with an `Error`, and the message names nothing. The name of a category of somebody else never leaves the service.
- **The folding runs in the application, in `Money`**: `Prisma.Decimal` with 40 significant digits (`common/money.ts`), shared with the account balance. The amounts of the rows are `Money` values, so the caller's `plus` and `minus` stay exact; a sum that starts from `new Prisma.Decimal(0)` does not.
- **The range decides what counts.** Everything dated in it counts, a planned transaction in the future included; the service does not know today. Transfers and the opening balance never count. A range whose `from` is after `to` holds nothing and answers `[]`.
- **The order is part of the contract:** currency, then the name of the category by code units (case-sensitive, like the uniqueness of names), the rows without a category last. Not `localeCompare`: it depends on the ICU data and the locale of the server. A caller that sorts on something else keeps this order for ties.
- **No new index, and no `accountId in`.** Measured on Postgres 17 with Prisma 7.8 over the SQL it produces, medians of 7 runs through Prisma, 66 groups returned (three accounts, ten categories and none, two types):

  | Rows                  | Window   | Scope and range only | Plus `accountId in` |
  | --------------------- | -------- | -------------------- | ------------------- |
  | 25 thousand, one user | 3 months | 5.5 ms               | 5.3 ms              |
  | 25 thousand, one user | 1 year   | 9.1 ms               | 9.8 ms              |
  | 2 million, 100 users  | 3 months | 5.4 ms               | 5.9 ms              |
  | 2 million, 100 users  | 1 year   | 10.6 ms              | 12.6 ms             |

  With the range in the filter the planner starts from the accounts of the owner and reads `(accountId, date, createdAt, id)` for each (nested loop, bitmap index scan), as the balance does only with the ids; adding the ids made the plan worse (a sort and a group aggregate instead of a hash aggregate).

## Alternatives considered

- **The dashboard reads the Prisma models** – breaks the rule of the domains and puts the knowledge of the owner scope into a second domain.
- **One raw SQL statement with a join on the account, `date_trunc` and a sum per currency** – a single query, but the owner would be written by hand into the `WHERE` and the type-level guarantee that the scope fits the models would not cover it (the reason of ADR 0018).
- **Rows per account, folded by the dashboard** – the dashboard would have to know the accounts and their currencies, which is the data model of `transactions`. Folding by currency is knowledge of the domain, not of the display.
- **A currency column on `Transaction`** – a migration and a second source of truth for what `groupBy` cannot do; the currency of an account never changes, so reading the accounts is enough.
- **Amounts as strings** – safe across the boundary, but the caller parses them again to add or subtract and then guards the precision itself.
- **Loading the rows, or `include: { transactions }`, and adding up in the application** – every row travels for a few sums.
- **Reading the accounts first and passing their ids to the aggregation** – the plan the balance needs, but measured here as slower: the range already makes the planner use the index. It also puts one more read in front of the sums.
- **One method that also returns the net, the total of a currency and the order of the dashboard** – that is the shape of one screen (which period, whether planned payments count, how to sort), not a fact about the transactions. A second consumer would have to undo it.

## Consequences

- Every other reader of the transactions goes through this service or another public service of the domain. A new kind of figure is a new method here, not a query in the consumer.
- The precision travels with the value. A consumer must start a sum from one of the returned amounts (or from its own `Money`), never from a plain `Prisma.Decimal`; a spec of the consumer should hold amounts that need more than 20 digits.
- Three queries are not one snapshot. It does not matter: the sums are the result of one statement, what they refer to cannot disappear, and an account created after the sums is simply not counted.
- The planner chooses the plan, not the query. A new version of Prisma or the driver adapter, a window of many years or accounts with millions of rows each is a reason to measure again; a covering index would have to be a hand-written migration (Prisma cannot express `INCLUDE`).
- The order by code units puts `Čaj` after `Zebra`. It is only the order for ties; a caller that needs the order of a language sorts the names itself.
- The accounts and categories of the owner are read by id, so the cost of the second step grows with the number of categories that have a transaction in the range (tens), not with the number of transactions.
- A fault in the data (a null sum, a transaction on an account the owner does not have) ends as a `500` in the log, not as a wrong figure.
