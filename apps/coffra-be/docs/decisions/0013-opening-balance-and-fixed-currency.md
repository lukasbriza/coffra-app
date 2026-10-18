# 0013 – Opening balance as an account field, currency fixed at creation

- **Status:** Accepted
- **Date:** 2026-10-06
- **Milestone / task:** M2, #18 (T14); extends [0005](./0005-money-and-currency.md)

## Context

Accounts exist long before they are entered into the app, so an account balance (T19) needs a starting point. The dashboard (T21) reports the income/expense ratio per category, so whatever carries that starting point must not count as income or expense. ADR [0005](./0005-money-and-currency.md) put the currency on the account and gave a transaction no currency of its own: the amounts of the transactions of an account are in the account currency. 0005 is accepted and is not edited, this record extends it.

## Decision

- **`Account.openingBalance`**: `Decimal(19,4) NOT NULL DEFAULT 0`, the balance before the first recorded transaction, in the account currency. It may be negative (overdraft, credit card) and may be changed later as a correction (`PATCH`). In the API it is a decimal string like every amount: in as `"-1500.25"` (a JSON number is a `400`), out with exactly four decimal places (`"-1500.2500"`).
- **Balance** (T19) = `openingBalance` + income + transfer `in` − expense − transfer `out`. The opening balance is not a transaction and never counts as income.
- **The currency is set when the account is created and never changes.** `PATCH` with a `currency` is a `400` (`currency cannot be changed after the account is created`), even with the same value and even for an account without transactions. Another currency means another account.
- **Amounts in responses always have four decimal places** (the column scale, `toFixed(4)`): the same amount is always the same string, never in exponent notation. Formatting per currency (two places for CZK, none for JPY) is the client's job.

## Alternatives considered

- **An opening income transaction** – no schema change, but it would distort the income/expense ratio of the dashboard, needs a category or a special case, and cannot be negative (`amount > 0`).
- **A special transaction type `opening`** – a new enum value, a change to the `transfer_shape` CHECK, and every aggregation would have to exclude it.
- **Balance snapshots / reconciliation** – the right tool once bank sync delivers real balances, far more than the MVP needs.
- **Currency changeable while the account has no transactions** (`409` otherwise) – a rule that depends on state, a `count` before the write without a lock, and the app has no use for it: the currency is chosen when the account is created.
- **Currency changeable at any time** – the amounts of the existing transactions would silently change meaning.
- **Minimal decimal notation in responses** (`"1250.5"`) – shorter, but the same amount could come out as different strings depending on how it was stored.

## Consequences

- An account balance is not the sum of its transactions; the dashboard and any export must not assume it is.
- Correcting `openingBalance` shifts the balance of the account over its whole history, and there is no audit of such corrections.
- Changing the currency of an account means creating a new account and moving the transactions; there is no endpoint for that, nor a need yet.
- A client that sends amounts as JSON numbers gets a `400` and has to send strings.
