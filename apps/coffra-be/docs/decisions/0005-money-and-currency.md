# 0005 – Money as Decimal, currency per account

- **Status:** Accepted
- **Date:** 2026-10-01
- **Milestone / task:** M0, #1 (T1), #2 (T2); API shape in M2/M3

## Context

Amounts in several currencies can exist. Floating point is not acceptable for money, and currency
conversion is a large scope that the MVP does not need.

## Decision

- `Transaction.amount` is `Decimal(19,4)`, always positive (CHECK `amount > 0`); the sign comes from `type` and, for transfers, `transferDirection`. In the API it is a string, so no precision is lost in JSON.
- `Transaction.date` is a `DATE` (no time, no time zone).
- The currency is a property of the `Account` (`CHAR(3)`, CHECK `^[A-Z]{3}$`). A transaction has no currency of its own. The format is checked, not the ISO list.
- No currency conversion and no base currency. The dashboard returns its aggregation separately for each currency. A transfer is allowed only between accounts of the same currency.

## Alternatives considered

- **One currency for the whole app** – simplest, but forbids accounts in other currencies.
- **Conversion with exchange rates and a base currency** – needs rate sources and historical rates; far more scope, not for the MVP.

## Consequences

- Summing across accounts is only meaningful per currency; there is no single "total balance".
- Adding conversion later means adding rates and a base currency on top, the stored amounts stay valid.
