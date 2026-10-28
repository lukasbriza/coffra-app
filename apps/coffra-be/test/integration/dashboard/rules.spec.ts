import { describe, expect, it } from 'vitest'

import { stopClock } from '../support/clock'
import { currencyOf, getDashboard } from '../support/dashboard-checks'
import type { CategoryBody, MonthBody } from '../support/dashboard-sql'
import { clearTransactions, writeRows } from '../support/ledger'
import { useIntegrationApp } from '../support/use-integration-app'
import type { World } from '../support/world'

/** The middle of October 2026: the window of `3m` is 2026-08-01 .. 2026-10-31, and the 16th to the 31st are still ahead. */
const CLOCK = '2026-10-15T12:00:00.000Z'
const MONTHS = ['2026-08', '2026-09', '2026-10']
const ZERO = '0.0000'

/** `[income, expense, net]` of a month. */
type Figures = [income: string, expense: string, net: string]

/**
 * The series of the months of the window: the months named in `figures` have their numbers, the others are zeros.
 *
 * @param figures - the figures by month (`YYYY-MM`)
 * @returns the `trend` of an answer
 */
const trendOf = (figures: Record<string, Figures>): MonthBody[] =>
  MONTHS.map((month) => {
    const [income, expense, net] = figures[month] ?? [ZERO, ZERO, ZERO]

    return { month, income, expense, net }
  })

/**
 * A category row of an answer.
 *
 * @param categoryId - the category, `null` for the transactions without one
 * @param name - its name, `null` with it
 * @param figures - income, expense and net
 * @returns the row
 */
const row = (categoryId: string | null, name: string | null, [income, expense, net]: Figures): CategoryBody => ({
  categoryId,
  name,
  income,
  expense,
  net,
})

// The rules of the dashboard on a few rows with the numbers worked out by hand. The comparison with SQL proves that
// the API and the SQL agree; these prove that what they agree on is the rule.
describe('the rules of the dashboard', () => {
  const { as, world, prisma, issueToken } = useIntegrationApp()

  /** The clock at `CLOCK`, and a database with no transaction at all (the seed of the world is dated in January). */
  const start = async (): Promise<World> => {
    const users = await stopClock(CLOCK, world(), issueToken)
    await clearTransactions(prisma())

    return users
  }

  it('leaves transfers out, whatever their size', async () => {
    const { a } = await start()
    await writeRows(prisma(), [
      {
        accountId: a.accounts.main,
        type: 'income',
        amount: '100',
        date: '2026-09-05',
        categoryId: a.categories.salary,
      },
      { accountId: a.accounts.main, type: 'expense', amount: '30', date: '2026-09-06', categoryId: a.categories.food },
    ])
    const before = await getDashboard(as(a))

    await as(a)
      .post('/api/transfers', {
        fromAccountId: a.accounts.main,
        toAccountId: a.accounts.savings,
        amount: '999999',
        date: '2026-09-10',
      })
      .expect(201)
    const after = await getDashboard(as(a))

    expect(after).toStrictEqual(before)
    expect(currencyOf(after, 'CZK')).toStrictEqual({
      currency: 'CZK',
      income: '100.0000',
      expense: '30.0000',
      net: '70.0000',
      categories: [
        row(a.categories.salary, 'Salary', ['100.0000', ZERO, '100.0000']),
        row(a.categories.food, 'Food', [ZERO, '30.0000', '-30.0000']),
      ],
      trend: trendOf({ '2026-09': ['100.0000', '30.0000', '70.0000'] }),
    })
  })

  it('leaves the opening balance of an account out', async () => {
    const { a } = await start()
    await writeRows(prisma(), [
      {
        accountId: a.accounts.main,
        type: 'income',
        amount: '100',
        date: '2026-09-05',
        categoryId: a.categories.salary,
      },
      { accountId: a.accounts.main, type: 'expense', amount: '30', date: '2026-09-06', categoryId: a.categories.food },
    ])
    const before = await getDashboard(as(a))

    await as(a).patch(`/api/accounts/${a.accounts.main}`, { openingBalance: '123456' }).expect(200)
    const after = await getDashboard(as(a))

    // Control: the account has the new opening balance, so a dashboard that counted it would have moved.
    const account = await as(a).get(`/api/accounts/${a.accounts.main}`).expect(200)
    expect((account.body as { balance: string }).balance).toBe('123526.0000')
    expect(after).toStrictEqual(before)
    expect(currencyOf(after, 'CZK').income).toBe('100.0000')
  })

  it('counts a planned payment later this month, and not one in the next month', async () => {
    const { a } = await start()
    await writeRows(prisma(), [
      { accountId: a.accounts.main, type: 'income', amount: '7', date: '2026-10-16' },
      { accountId: a.accounts.main, type: 'expense', amount: '10', date: '2026-10-31' },
      { accountId: a.accounts.main, type: 'expense', amount: '1000', date: '2026-11-01' },
    ])

    const body = await getDashboard(as(a))

    expect(body.to).toBe('2026-10-31')
    expect(currencyOf(body, 'CZK')).toStrictEqual({
      currency: 'CZK',
      income: '7.0000',
      expense: '10.0000',
      net: '-3.0000',
      categories: [row(null, null, ['7.0000', '10.0000', '-3.0000'])],
      trend: trendOf({ '2026-10': ['7.0000', '10.0000', '-3.0000'] }),
    })
  })

  it('shows the transactions without a category as a row of their own, last, however large it is', async () => {
    const { a } = await start()
    await writeRows(prisma(), [
      { accountId: a.accounts.main, type: 'income', amount: '30', date: '2026-09-01', categoryId: a.categories.salary },
      { accountId: a.accounts.main, type: 'expense', amount: '20', date: '2026-09-02', categoryId: a.categories.food },
      { accountId: a.accounts.main, type: 'expense', amount: '500', date: '2026-09-03' },
    ])

    const czk = currencyOf(await getDashboard(as(a)), 'CZK')

    expect(czk.categories).toStrictEqual([
      row(a.categories.salary, 'Salary', ['30.0000', ZERO, '30.0000']),
      row(a.categories.food, 'Food', [ZERO, '20.0000', '-20.0000']),
      row(null, null, [ZERO, '500.0000', '-500.0000']),
    ])
    expect([czk.income, czk.expense, czk.net]).toStrictEqual(['30.0000', '520.0000', '-490.0000'])
  })

  it('shows a category that has both income and expense with both and the net', async () => {
    const { a } = await start()
    await writeRows(prisma(), [
      { accountId: a.accounts.main, type: 'income', amount: '40', date: '2026-09-01', categoryId: a.categories.food },
      { accountId: a.accounts.main, type: 'expense', amount: '15', date: '2026-09-02', categoryId: a.categories.food },
    ])

    const czk = currencyOf(await getDashboard(as(a)), 'CZK')

    expect(czk.categories).toStrictEqual([row(a.categories.food, 'Food', ['40.0000', '15.0000', '25.0000'])])
    expect([czk.income, czk.expense, czk.net]).toStrictEqual(['40.0000', '15.0000', '25.0000'])
  })

  it('orders the categories by income plus expense, and categories of the same size by name in code units', async () => {
    const { a } = await start()
    const ids = {
      rent: 'b0000000-0000-4000-8000-000000000001',
      fun: 'b0000000-0000-4000-8000-000000000002',
      health: 'b0000000-0000-4000-8000-000000000003',
      abel: 'b0000000-0000-4000-8000-000000000004',
    }
    await prisma().category.createMany({
      data: [
        { id: ids.rent, userId: a.userId, name: 'Rent' },
        { id: ids.fun, userId: a.userId, name: 'Zábava' },
        { id: ids.health, userId: a.userId, name: 'zdraví' },
        { id: ids.abel, userId: a.userId, name: 'Ábel' },
      ],
    })
    await writeRows(prisma(), [
      { accountId: a.accounts.main, type: 'expense', amount: '50', date: '2026-09-01', categoryId: ids.rent },
      { accountId: a.accounts.main, type: 'income', amount: '25', date: '2026-09-02', categoryId: a.categories.salary },
      { accountId: a.accounts.main, type: 'expense', amount: '10', date: '2026-09-03', categoryId: ids.abel },
      { accountId: a.accounts.main, type: 'expense', amount: '10', date: '2026-09-04', categoryId: ids.health },
      { accountId: a.accounts.main, type: 'expense', amount: '10', date: '2026-09-05', categoryId: ids.fun },
      { accountId: a.accounts.main, type: 'expense', amount: '10', date: '2026-09-06', categoryId: a.categories.food },
      { accountId: a.accounts.main, type: 'expense', amount: '5', date: '2026-09-07', categoryId: a.categories.unused },
    ])

    const czk = currencyOf(await getDashboard(as(a)), 'CZK')

    // `Food`, `Zábava`, `zdraví`, `Ábel`: `F` < `Z` < `z` < `Á` as code units. A locale comparison would put `Ábel` first.
    expect(czk.categories.map(({ name }) => name)).toStrictEqual([
      'Rent',
      'Salary',
      'Food',
      'Zábava',
      'zdraví',
      'Ábel',
      'Unused',
    ])
  })

  it('keeps the currencies apart, and leaves out a currency that has an opening balance only', async () => {
    const { a } = await start()
    const dollars = await as(a).post('/api/accounts', { name: 'Dollars', type: 'bank', currency: 'USD' }).expect(201)
    const dollarsId = (dollars.body as { id: string }).id
    await writeRows(prisma(), [
      { accountId: a.accounts.main, type: 'income', amount: '100', date: '2026-09-01' },
      { accountId: dollarsId, type: 'income', amount: '7', date: '2026-09-02' },
      { accountId: dollarsId, type: 'expense', amount: '2', date: '2026-09-03' },
    ])

    const body = await getDashboard(as(a))

    // The euro account of the seed has an opening balance and no transaction.
    expect(body.currencies.map(({ currency }) => currency)).toStrictEqual(['CZK', 'USD'])
    expect(currencyOf(body, 'CZK')).toMatchObject({ income: '100.0000', expense: ZERO, net: '100.0000' })
    expect(currencyOf(body, 'USD')).toMatchObject({ income: '7.0000', expense: '2.0000', net: '5.0000' })

    // Control: the first transaction on the euro account brings its currency in, in alphabetical order.
    await writeRows(prisma(), [{ accountId: a.accounts.euro, type: 'income', amount: '1', date: '2026-09-04' }])
    const withEuro = await getDashboard(as(a))

    expect(withEuro.currencies.map(({ currency }) => currency)).toStrictEqual(['CZK', 'EUR', 'USD'])
    expect(currencyOf(withEuro, 'EUR')).toMatchObject({ income: '1.0000', expense: ZERO, net: '1.0000' })
  })

  it('answers a window with nothing in it with no currencies', async () => {
    const { a } = await start()

    const body = await getDashboard(as(a))

    expect(body).toStrictEqual({ period: '3m', from: '2026-08-01', to: '2026-10-31', currencies: [] })
  })

  it('follows what the owner writes through the API', async () => {
    const { a } = await start()
    const { main, savings } = a.accounts

    const income = await as(a)
      .post('/api/transactions', {
        accountId: main,
        type: 'income',
        amount: '100',
        date: '2026-09-05',
        categoryId: a.categories.salary,
      })
      .expect(201)
    const expense = await as(a)
      .post('/api/transactions', {
        accountId: main,
        type: 'expense',
        amount: '40',
        date: '2026-10-02',
        categoryId: a.categories.food,
      })
      .expect(201)

    const written = currencyOf(await getDashboard(as(a)), 'CZK')
    expect([written.income, written.expense, written.net]).toStrictEqual(['100.0000', '40.0000', '60.0000'])
    expect(written.trend).toStrictEqual(
      trendOf({ '2026-09': ['100.0000', ZERO, '100.0000'], '2026-10': [ZERO, '40.0000', '-40.0000'] }),
    )

    await as(a).patch(`/api/categories/${a.categories.food}`, { name: 'Groceries' }).expect(200)
    const renamed = currencyOf(await getDashboard(as(a)), 'CZK')
    expect(renamed.categories.map(({ name }) => name)).toStrictEqual(['Salary', 'Groceries'])

    // Moved to another account of the same currency: nothing changes in the figures.
    const expenseId = (expense.body as { id: string }).id
    await as(a).patch(`/api/transactions/${expenseId}`, { accountId: savings }).expect(200)
    expect(currencyOf(await getDashboard(as(a)), 'CZK')).toStrictEqual(renamed)

    // Deleted: the income goes, the expense stays and keeps the currency in the answer.
    await as(a)
      .delete(`/api/transactions/${(income.body as { id: string }).id}`)
      .expect(204)
    const deleted = currencyOf(await getDashboard(as(a)), 'CZK')
    expect([deleted.income, deleted.expense, deleted.net]).toStrictEqual([ZERO, '40.0000', '-40.0000'])
    expect(deleted.categories.map(({ name }) => name)).toStrictEqual(['Groceries'])
  })
})
