# Design brief — coffra-web

Plan: no `apps/coffra-web` plan yet. Read: `docs/00_plan.md` (MVP, repo level),
`apps/coffra-be/docs/plans/T21-dashboard-endpoint.md` (issue
[#27](https://github.com/lukasbriza/coffra-app/issues/27)),
`apps/coffra-be/docs/plans/T31-monthly-trend.md` (issue
[#28](https://github.com/lukasbriza/coffra-app/issues/28)).
Issue for the web dashboard: none yet.

Workspaces: `<ui>` = `apps/coffra-web` (Next.js 16 App Router, web). `<api>` = `apps/coffra-be`, contract
`packages/coffra-api/src/schema.json`. Every field below comes from that contract; there is one `<api>`, so no
per-field origin is needed.

Direction and requester's constraints: `design/DESIGN.md`.

## Locale and formats

- UI locale `cs` (`apps/coffra-web/src/i18n/config.ts`: locales `cs`, `en`). The screens are drawn in `cs`.
- Money: `Intl.NumberFormat('cs-CZ', { style: 'currency', currency })` → `312 000,00 Kč` (no-break spaces), net with
  `signDisplay: 'exceptZero'` → `+158 842,00 Kč`. The amount arrives as a four-decimal string (ADR 0005); it is
  parsed as a decimal, never summed as a float on the client.
- Percent: `50,9 %`, one decimal place.
- Dates: `21. 11. 2026`; a month as `listopad 2026`. API dates are UTC calendar days (ADR 0021).
- One currency on screen at a time (requester's constraint): a currency switch picks one entry of `currencies`; CZK is
  selected in the drawing. The contract carries one entry per currency (ADR 0005: amounts of two currencies are never
  added or converted).

## Screens implied by the contract

Listed for scope only; only the dashboard is designed in this pass.

| Screen | Endpoints |
|---|---|
| Dashboard | `GET /api/dashboard` |
| Transactions | `GET/POST /api/transactions`, `PATCH/DELETE /api/transactions/{id}`, `POST /api/transfers`, `PATCH/DELETE /api/transfers/{pairId}` |
| Accounts | `GET/POST /api/accounts`, `GET/PATCH/DELETE /api/accounts/{id}` |
| Categories | `GET/POST /api/categories`, `GET/PATCH/DELETE /api/categories/{id}` |
| Settings | `GET /api/users/me`, `POST /api/users/me/deletion`, `POST /api/auth/logout` |
| Sign-in | `GET /api/auth/login`, `GET /api/auth/callback`, `POST /api/auth/refresh` |

## Dashboard

- Route: `/[locale]/` (`/cs/`), the first screen after sign-in.
- Endpoints: `GET /api/dashboard?period=3m|6m|1y`. The screen asks for `6m` by default (requester's decision; the
  server's own default for a missing `period` is `3m`). Navigation and the add action need nothing else; `GET
  /api/users/me` gives the email shown in the navigation.
- Controls: the period (`3m` | `6m` | `1y`) and the currency (the `currency` values of `currencies`, alphabetical; the
  seed gives `CZK` and `EUR`). Switching the currency needs no request, since every currency is in one response;
  changing the period refetches the dashboard.
- Key question: Did I earn more than I spent over the period, and what do I spend the most on? (requester)
- Role: the signed-in owner, single user (ADR 0006, 0012). No shared or read-only view.
- Fields (`DashboardDto`):
  - `period` (`DashboardPeriod`: `3m` | `6m` | `1y`, required) — the period used; `3m` when the query leaves it out.
  - `from`, `to` (string, date, required) — first day of the oldest month, last day of the current month.
  - `currencies` (`CurrencyTotalsDto[]`, required) — one per currency with a counted transaction, alphabetical;
    `[]` when nothing falls in the window.
  - `CurrencyTotalsDto`: `currency` (three capitals), `income`, `expense`, `net` (decimal strings, four places;
    `net` negative when more was spent), `categories` (`CategoryTotalsDto[]`), `trend` (`MonthTotalsDto[]`), all
    required.
  - `CategoryTotalsDto`: `categoryId` (uuid, nullable), `name` (string, nullable — `null` together with
    `categoryId` on the row of transactions without a category), `income`, `expense`, `net`. Ordered by
    `income + expense` descending; the `null` row last whatever its size.
  - `MonthTotalsDto`: `month` (`YYYY-MM`, UTC), `income`, `expense`, `net`. Exactly 3, 6 or 12 entries, oldest
    first; a month without a transaction is present with zeros.
- Derived on the client (ADR 0021 leaves ratios, shares and rounding to the client):
  - share of income left: `net / income` — the MVP plan's "% of income that can be invested". Undefined when
    `income` is `0`; shown as `—` then.
  - a category's share of expense: `category.expense / currency.expense`; its share of income:
    `category.expense / currency.income` — the plan's "income/expense ratio per category", read as the part of
    the money spent and of the money earned that a category takes.
  - top spending category: the category row with the largest `expense`, the `null` row included.
  - ring chart of one side (expense or income), requester's rule: the category rows ranked by that side's amount (rows
    with zero on that side left out, the `null` row ranked like any other), the five largest as slices and the rest
    summed into one slice `Ostatní (n)`, where `n` is how many rows it holds; each slice's share is its amount ÷ the
    side's total. The largest slice's share and name sit in the ring's centre.
  - the wording of the `null` row: `Bez kategorie` (ADR 0021: the server does not word it).
- Volume: categories are user-made (the demo user has 9; ADR 0014 sets no limit); the trend has 3, 6 or 12 rows.
  One currency on screen.
- Data drawn on the screen: the demo seed (`apps/coffra-be/scripts/seed/demo-data.ts`, ADR 0024) evaluated for
  today = 21. 11. 2026, `period=6m`, window `1. 6. 2026 – 30. 11. 2026`, currency CZK:
  - income `312 000,00 Kč`, expense `153 158,00 Kč`, net `+158 842,00 Kč`, share of income left `50,9 %`.
  - expense by category: Bydlení `100 800,00` (65,8 % of expense, 32,3 % of income), Jídlo `31 300,00`
    (20,4 / 10,0), Doprava `11 700,00` (7,6 / 3,8), Zábava `5 050,00` (3,3 / 1,6), Předplatná `1 968,00`
    (1,3 / 0,6), Zdraví `840,00` (0,5 / 0,3), Bez kategorie `1 500,00` (1,0 / 0,5).
  - income by category: Mzda `312 000,00` (100 % of income).
  - expense ring: Bydlení 65,8 %, Jídlo 20,4 %, Doprava 7,6 %, Zábava 3,3 %, Předplatná 1,3 %, `Ostatní (2)`
    `2 340,00` 1,5 % (Zdraví `840,00` + Bez kategorie `1 500,00`). Income ring: Mzda 100,0 %, one slice, no
    `Ostatní`.
  - trend (income / expense / net): červen `52 000 / 25 398 / +26 602`, červenec `52 000 / 24 338 / +27 662`,
    srpen `52 000 / 23 878 / +28 122`, září `52 000 / 24 698 / +27 302`, říjen `52 000 / 23 968 / +28 032`,
    listopad `52 000 / 30 878 / +21 122`.
  - the awkward cases this data carries on purpose: November is the current month and contains a planned payment
    dated 24. 11. (`Pojištění auta`, 8 400 Kč, Doprava), after today — it counts (ADR 0021), which is why
    November's expense is the highest; the `null` row sits last although Zdraví is smaller; Zdraví has spending in
    only two of the six months.
  - the EUR entry of the seed (`Vedlejší příjem`, `Cestování`) is present as the second segment of the currency switch
    and not drawn: one currency on screen, CZK selected.
- Empty state: `currencies: []` — a new owner or a window with no income or expense. Transfers alone and opening
  balances alone also give `[]` (ADR 0021).
- Failure states: `400` (a `period` that is not offered, or repeated), `401` (expired or missing access token →
  refresh, then sign-in).
- Constraints from `<api>`:
  - ADR 0005 — amounts are decimal strings, one currency per account, never converted or added across currencies.
  - ADR 0003, 0017, 0021 — transfers between own accounts and opening balances are neither income nor expense; the
    dashboard never shows them as such.
  - ADR 0021 — window of whole UTC calendar months including the current one, ending on its last day; planned
    transactions dated inside the window count. No custom range, no account filter. The client words the
    category-less row and computes ratios and shares.
  - ADR 0022 — the trend has exactly one entry per month, zeros included; its months add up to the totals.
  - ADR 0014 — category names are unique per owner and case-sensitive; the longest is 100 characters
    (`@IsResourceName()`), so a category name must truncate.
- Out of scope (MVP plan, T21/T31 plans): investments, financial-freedom target, user-defined metrics, custom
  date range, account filter, bank sync, currency conversion.
