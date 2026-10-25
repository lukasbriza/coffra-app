# 0015 – Income and expense transactions: references checked by scoped reads, transfer sides read-only, dates as UTC calendar days

- **Status:** Accepted
- **Date:** 2026-10-19

## Context

`POST/GET/PATCH/DELETE /api/transactions` records income and expense. Four things about it are not obvious from the code and are hard to change once clients rely on them:

- **References in the body.** `Transaction` has no `userId` (ADR [0004](./0004-ownership-through-account.md)), so the foreign keys accept an account or a category of another user, and nothing in the database checks that a transaction stays in the currency of its account (ADR [0005](./0005-money-and-currency.md)). ADR [0014](./0014-category-names-and-delete.md) lets the database decide conflicts instead of checking beforehand; here the database cannot decide.
- **Status codes.** A foreign id in the path is a `404` (ADR [0012](./0012-ownership-layer.md)), but nothing said what a foreign id in the body is, or what a valid request against an incompatible state is.
- **Transfers.** A transfer is two paired rows (ADR [0003](./0003-transfer-as-paired-rows.md)) with an API of its own. Changing or deleting one side here would break the pair.
- **Dates.** `Transaction.date` is a `DATE`, but JavaScript holds it as a `Date` with a time, and the server can run in any time zone. `@prisma/adapter-pg` writes the UTC date part of the parameter and the client reads a `DATE` back as midnight UTC (checked in Prisma 7.8.0), so a day only moves when the application builds or reads the `Date` in local time: `new Date(2026, 9, 19)` on a server at UTC+14 is stored as `2026-10-18`.

## Decision

- **References are checked by reading them through the owner scope** before the write: `account.findFirst({ where: { id, ...scope } })` and the same for the category, both at once, the account reported first. A foreign or missing one is `404 Account not found` / `404 Category not found` (`ownership.orNotFound`, the same body as `GET` of that resource). With one owner per request, both then belong to the owner and to each other.
- **The check before the write is safe here** because what it checks never changes: the owner of an account or a category is fixed, and so is the currency of an account (ADR [0013](./0013-opening-balance-and-fixed-currency.md)). Only existence can change between the check and the write; the `Restrict` foreign key catches that as `P2003`, after which the service reads the references again and answers the same `404`. If ownership or the currency ever becomes changeable (workspaces), this has to be reconsidered.
- **Status rule:** `400` when the request alone decides (the DTO), `404` for an id the owner does not have (in the path or in the body), `409` when the request is valid but conflicts with what is stored (`Restrict`, a unique constraint, a side of a transfer, another currency).
- **A side of a transfer is read-only here.** `GET :id` returns it with `transferPairId` and `transferDirection`; `PATCH` and `DELETE` answer `409 Transaction is part of a transfer and cannot be changed here`. Creating one is impossible (`type` is `income` or `expense` only, a `400`). Every write also carries `type in (income, expense)` in its `where`, so even a write that skipped the check cannot touch a pair.
- **Moving to another account** is allowed to an own account of the same currency only; another currency is a `409`. The amount is in the currency of the account and nothing converts it.
- **Dates are calendar days.** In: `YYYY-MM-DD`, a day that exists, years 0001–9999 (`@IsIsoDate()`, the round trip through `parseIsoDate`/`formatIsoDate` refuses `2026-02-30`; Postgres has no year 0). To Prisma: midnight UTC (`parseIsoDate`). Out: read in UTC (`formatIsoDate`). Never `new Date(year, month, day)`, `Date.UTC` (years 0–99 become 1900–1999) or the local getters.
- **The view** carries `transferPairId` and `transferDirection` already: the list and the transfers share it. A note is trimmed and a blank one is stored as `null`, so "no note" has one form.

## Alternatives considered

- **`422` for a bad reference in the body** – semantically precise, but a status nothing else in the API uses; a client would have to tell a `404` of the path from one of the body by the status instead of the message.
- **`400` for a bad reference** – mixes "malformed" with "does not exist".
- **Prisma `connect: { id, userId }`** – one statement, but a failure is a `P2025` that does not say whether the account or the category is missing, and it cannot check the currency.
- **`userId` on `Transaction` with a composite foreign key `(accountId, userId)`** – lets the database check the owner, rejected in ADR 0004 (a redundant column that can disagree with the account).
- **A trigger for the currency** – logic outside what the Prisma schema shows.
- **`404` for a side of a transfer on `PATCH`/`DELETE`** – `GET` returns it, so the API would contradict itself.
- **No moving between accounts** – a typo in the account would mean delete and create again.
- **`400` for another currency** (what was first assumed for transfers) – the request is well-formed; the conflict is with the stored currency of the target account.
- **Dates at local midnight, or as `TEXT`** – the first moves by a day depending on the server, the second loses the type and the ordering in the database.

## Consequences

- A write costs one or two extra reads (run at once). A forgotten scope in one of them would attach a transaction to another user's account: review checks it, the service specs pin the `where`, isolation tests go through the database.
- Moving a transaction changes the balance of two accounts (balances are computed from the database).
- Transfers follow the status rule: the same account on both sides is a `400` (the request alone decides), another currency a `409`. Its writes must not go through these routes.
- Every date in the API (the `from`/`to` of the list, transfers, the dashboard) goes through `@IsIsoDate()` and `parseIsoDate`/`formatIsoDate`. An upgrade of Prisma or the driver adapter can change how a `DATE` travels; the unit specs only cover our side (they run in six time zones), the database side was verified against Postgres with the server at UTC+14 and UTC−11 and belongs in a database test suite.
