# 0021 – Dashboard: a feature of `transactions`, calendar windows, totals per currency

- **Status:** Accepted
- **Date:** 2026-10-26

## Context

The dashboard shows what the owner earned and spent in the last months. Every figure on it comes from the transactions: it has no table of its own and no other domain feeds it. ADR [0001](./0001-modular-monolith.md) planned it as a domain of its own, on the ground that a dashboard is cross-domain by nature. Today it is not: nothing but `transactions` is read.

Constraints:

- A currency lives on the account (ADR [0005](./0005-money-and-currency.md)) and nothing is converted, so the totals of two currencies cannot be added.
- A transfer only moves money between accounts and the opening balance of an account is not a transaction (ADR [0013](./0013-opening-balance-and-fixed-currency.md)): neither is income or expense.
- Every query on the transactions carries the owner scope (ADR [0012](./0012-ownership-layer.md)); the sums come from `TransactionTotalsService` (ADR [0020](./0020-transaction-totals.md)), which already folds them per currency and category.
- A domain reads the data of another only through a public service (ADR 0001). A dashboard in a domain of its own would have to reach the amount arithmetic and the amount format of `transactions` (`Money`, `formatMoney`) through the barrel or from `src/utils`, away from the rest of the money code.

## Decision

- **The dashboard is a feature of the `transactions` domain**, `transactions/dashboard/`, with its own feature module imported by `TransactionsModule`. There is no `dashboard` domain; the domains are `core` and `transactions`. The dashboard reads the transactions through `TransactionTotalsService` and nothing else, and has no table. An overview of another area (investments) belongs to that area, and a screen that really mixes areas would be a domain of its own when it exists. `TransactionTotalsService` stays exported through the barrel for such a domain.
- **`GET /api/dashboard?period=3m|6m|1y`**, `3m` when left out. A value that is not offered, an empty one and a repeated parameter are a `400`. An unknown parameter is dropped by the global `whitelist`, so a misspelt `perod=1y` counts as `3m`, like a misspelt filter anywhere else in the API. There is no custom range and no filter by account.
- **The window is made of whole calendar months:** the current month and the months before it, 3, 6 or 12 of them, from the first day of the oldest month to the last day of the current month. Today is the UTC day (`formatIsoDate(new Date())`), as for the balance of an account. The window is worked out by integer arithmetic on the year and the month of `YYYY-MM-DD`, with no `Date`, so no time zone can move it. A client east of UTC therefore sees the previous month between its own midnight and UTC midnight on the first of a month, as it sees the balance of the previous day.
- **Everything dated in the window counts, planned transactions with a date later this month included.** The figure then equals the list of transactions filtered by the same days. The balance of an account does not count planned transactions (ADR [0018](./0018-account-balances.md)); the dashboard answers a different question (what the month adds up to), not what is on the account now.
- **Transfers and the opening balance of an account never count.**
- **Totals per currency, never converted.** The answer holds only the currencies that have at least one counted transaction, in the order of the totals service (alphabetical), so an owner without transactions gets `currencies: []`. The answer carries the `period` that was used (the default included) and the `from` and `to` of the window.
- **Only sums.** Every currency has `income`, `expense`, `net` (`income − expense`, negative when more was spent) and its `categories`, each with `categoryId`, `name`, `income`, `expense` and `net`. No ratio of income to expense and no share of a category: dividing by zero and rounding are the business of the client. Amounts are decimal strings with four decimal places.
- **A category has no type.** It may hold income and expense alike (the only rule is that it belongs to the same owner), so a row carries both sides and the net. The transactions without a category are one row with `categoryId: null` and `name: null`; the name of that row is not worded by the server.
- **The categories of a currency are ordered by `income + expense`, largest first**, the row without a category last whatever its size. Categories of the same size keep the order of the totals service (name by code units), which makes the order total.
- **Sums are computed in `Money`** (`Prisma.Decimal` with 40 digits), started from `new Money(0)`, and written as strings in the last step. A sum started from a plain `Prisma.Decimal(0)` would round at 20 digits.

## Alternatives considered

- **A `dashboard` domain of its own (ADR 0001)** – a boundary that guards nothing: the only data it reads is the data of `transactions`. It would need `Money` and `formatMoney` moved out of `transactions/common/` or exported through the barrel, and each new figure would be split between two domains.
- **A rolling window ending today (the last 90 days)** – the figures change every day and do not match the monthly view in which a budget is read.
- **A window ending today** – the planned payments of the month would be missing and the figure would differ from the list of transactions for the same days.
- **Converting every amount to one currency** – needs exchange rates and a rule for the day of the rate; ADR 0005 leaves conversion out.
- **Ratios and shares in the answer** – the server would decide how to round them and what a ratio is when the expense is zero.
- **A fixed kind (income or expense) on a category** – a change of the data model; the row carries both sides instead.
- **A worded name for the transactions without a category ("Uncategorized")** – wording and language are the client's; `categoryId: null` already says it.
- **Raw SQL with `date_trunc` and the currency in one statement** – the owner would be written by hand into the `WHERE`, which the type-level scope of the ownership layer does not cover (the reason of ADR 0018 and ADR 0020).
- **A window from the local day of the server, or from a time zone in the request** – the server's zone is an accident of the deployment; a zone in the request is a parameter to validate and test for little gain.

## Consequences

- A new figure is a new method of the totals service or a new feature; the dashboard does not query.
- `period` is a closed list in `constants.ts`; a new value is a line there and a row in `PERIOD_MONTHS`. A custom range would be a new, validated pair of parameters.
- The ratio, the shares and the wording of the row without a category are the client's.
- The first hours of a month in a time zone far east of UTC show the old month. The cure is a parameter with the client's day, as for the balance; it is not needed while the client is in one zone.
- The specs of the window need a fixed clock: the seed of the integration suite is dated in the past, and the window is counted from today.
- `TransactionTotalsService` is exported but has no consumer outside the domain for now.
