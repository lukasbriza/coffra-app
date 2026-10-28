import { Prisma, type PrismaService } from '../../../src/modules/prisma'

// The dashboard as plain SQL, written independently of the code it checks: the window comes from `date_trunc` and the
// series of months from `generate_series`, not from `periodWindow` or `foldMonths`. A spec that compares the answer of
// the API with this proves the two agree, and a bug that both share (a wrong rule) is caught by the specs with the
// numbers written by hand.

/** One calendar month of a currency, as the API spells it. */
export type MonthBody = { month: string; income: string; expense: string; net: string }

/** One category of a currency, as the API spells it. */
export type CategoryBody = {
  categoryId: string | null
  name: string | null
  income: string
  expense: string
  net: string
}

/** One currency, as the API spells it. */
export type CurrencyBody = {
  currency: string
  income: string
  expense: string
  net: string
  categories: CategoryBody[]
  trend: MonthBody[]
}

/** The body of `GET /api/dashboard`. Owned by the tests, so a change of the contract in `src/` shows as a failure here. */
export type DashboardBody = { period: string; from: string; to: string; currencies: CurrencyBody[] }

/** The periods the dashboard offers, and how many calendar months each covers (the current one included). */
export const MONTHS_OF_PERIOD = { '3m': 3, '6m': 6, '1y': 12 } as const

export type DashboardPeriod = keyof typeof MONTHS_OF_PERIOD

/** `YYYY-MM-DD` of a clock instant in UTC, cut from the ISO string (no `Date` arithmetic, no time zone). */
export const utcDayOf = (instant: string): string => instant.slice(0, 10)

type WindowRow = { from: string; to: string }
type CurrencyRow = { currency: string; income: string; expense: string; net: string }
type CategoryRow = CurrencyRow & { categoryId: string | null; name: string | null }
type MonthRow = CurrencyRow & { month: string }

/**
 * The window and the counted rows as two CTEs: the transactions of `userId` that are income or expense and dated from
 * the first day of the oldest month to the last day of the current one.
 *
 * `date_trunc` and `generate_series` over a `date` give a `timestamptz` that follows the time zone of the connection,
 * so everything is cast to `timestamp` first.
 *
 * @param userId - whose accounts
 * @param day - today, `YYYY-MM-DD` (UTC)
 * @param months - how many calendar months the window covers
 * @returns the CTEs `win` (`first_day`, `last_day`) and `counted` (`currency`, `categoryId`, `type`, `date`, `amount`)
 */
const windowAndRows = (userId: string, day: string, months: number): Prisma.Sql => Prisma.sql`
  win AS (
    SELECT (date_trunc('month', ${day}::date::timestamp) - make_interval(months => ${months - 1}::int))::date AS first_day,
           (date_trunc('month', ${day}::date::timestamp) + interval '1 month' - interval '1 day')::date AS last_day
  ),
  counted AS (
    SELECT a.currency, t."categoryId", t.type, t.date, t.amount
      FROM "Transaction" t
      JOIN "Account" a ON a.id = t."accountId"
      JOIN win ON t.date BETWEEN win.first_day AND win.last_day
     WHERE a."userId" = ${userId}::uuid AND t.type IN ('income', 'expense')
  )`

/**
 * What the dashboard of a user is on a given day, by plain SQL.
 *
 * Amounts are `numeric(40,4)` written as text, so they have four decimal places and no rounding. Currencies and
 * category names are ordered `COLLATE "C"` (code units, like the service), the categories by `income + expense`
 * descending with the row without a category last. Every currency has every month of the window, with zeros where
 * nothing was booked.
 *
 * @param prisma - the client of the app under test
 * @param userId - whose dashboard
 * @param options - `day` is today in UTC (`YYYY-MM-DD`), `period` is `3m`, `6m` or `1y`
 * @returns the body the API must answer
 */
export const sqlDashboard = async (
  prisma: PrismaService,
  userId: string,
  { day, period }: { day: string; period: DashboardPeriod },
): Promise<DashboardBody> => {
  const base = windowAndRows(userId, day, MONTHS_OF_PERIOD[period])

  const [window] = await prisma.$queryRaw<WindowRow[]>`
    WITH ${base} SELECT first_day::text AS "from", last_day::text AS "to" FROM win`

  const currencies = await prisma.$queryRaw<CurrencyRow[]>`
    WITH ${base}
    SELECT currency,
           COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)::numeric(40,4)::text AS income,
           COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::numeric(40,4)::text AS expense,
           (COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)
            - COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0))::numeric(40,4)::text AS net
      FROM counted
     GROUP BY currency
     ORDER BY currency COLLATE "C"`

  const categories = await prisma.$queryRaw<CategoryRow[]>`
    WITH ${base}
    SELECT s.currency,
           s."categoryId"::text AS "categoryId",
           c.name AS name,
           s.income::numeric(40,4)::text AS income,
           s.expense::numeric(40,4)::text AS expense,
           (s.income - s.expense)::numeric(40,4)::text AS net
      FROM (SELECT currency, "categoryId",
                   COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0) AS income,
                   COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0) AS expense
              FROM counted
             GROUP BY currency, "categoryId") s
      LEFT JOIN "Category" c ON c.id = s."categoryId"
     ORDER BY s.currency COLLATE "C", (s."categoryId" IS NULL), (s.income + s.expense) DESC, c.name COLLATE "C"`

  const months = await prisma.$queryRaw<MonthRow[]>`
    WITH ${base}
    SELECT cur.currency,
           to_char(m.month, 'YYYY-MM') AS month,
           COALESCE(SUM(counted.amount) FILTER (WHERE counted.type = 'income'), 0)::numeric(40,4)::text AS income,
           COALESCE(SUM(counted.amount) FILTER (WHERE counted.type = 'expense'), 0)::numeric(40,4)::text AS expense,
           (COALESCE(SUM(counted.amount) FILTER (WHERE counted.type = 'income'), 0)
            - COALESCE(SUM(counted.amount) FILTER (WHERE counted.type = 'expense'), 0))::numeric(40,4)::text AS net
      FROM (SELECT DISTINCT currency FROM counted) cur
     CROSS JOIN win
     CROSS JOIN generate_series(win.first_day::timestamp, win.last_day::timestamp, interval '1 month') AS m(month)
      LEFT JOIN counted
        ON counted.currency = cur.currency AND date_trunc('month', counted.date::timestamp) = m.month
     GROUP BY cur.currency, m.month
     ORDER BY cur.currency COLLATE "C", m.month`

  return {
    period,
    from: window.from,
    to: window.to,
    currencies: currencies.map(({ currency, income, expense, net }) => ({
      currency,
      income,
      expense,
      net,
      categories: categories
        .filter((row) => row.currency === currency)
        .map((row) => ({
          categoryId: row.categoryId,
          name: row.name,
          income: row.income,
          expense: row.expense,
          net: row.net,
        })),
      trend: months
        .filter((row) => row.currency === currency)
        .map((row) => ({ month: row.month, income: row.income, expense: row.expense, net: row.net })),
    })),
  }
}
