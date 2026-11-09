import { describe, expect, it, vi } from 'vitest'

import type { TokenPair } from '../../../src/modules/core/auth/types'
import type { AccountView } from '../../../src/modules/transactions/accounts/accounts.types'
import type { TransactionView } from '../../../src/modules/transactions/transactions/transactions.types'
import { CLIENT_ID, type FakeUser, REDIRECT_URI } from '../../e2e/support/fake-idp'
import { authorize, callback, checksCookiePair, claimsOf, startLogin } from '../../e2e/support/oidc-login'
import type { Client } from '../support/client'

import { ACCESS_TTL_SECONDS, useScenarioApp } from './setup'

// The path a real user takes, from the login to the logout, over HTTP against the real database: log in through the
// identity provider, open two accounts, add categories, record income and expenses, move money between the accounts,
// page through the transactions, read the balances and the dashboard, renew the session, log out. A second user who
// logs in through the same provider sees none of it.
//
// Every figure below is worked out by hand from this ledger, not read back from the API or recomputed by a query.
// The clock stands at 2026-03-18 10:00 UTC, so the window of `3m` is 2026-01-01..2026-03-31 and the one of `6m`
// 2025-10-01..2026-03-31.
//
//   main     "Běžný účet"  CZK  opening 12 500.50
//   savings  "Spoření"     CZK  opening 0
//
//   2025-12-20  income   1 000.00   Výplata   main   before the window of 3m, inside the one of 6m
//   2026-01-15  income  42 000.00   Výplata   main
//   2026-03-02  expense  1 234.56   Jídlo     main
//   2026-03-10  expense     89.90   (none)    main   "Parkování"
//   2026-03-12  transfer 5 000.00   main → savings  "Na spoření"
//   2026-03-25  expense  3 000.00   Bydlení   main   "Nájem", after today: planned
//
// Balances today: main 12 500.50 + 1 000 + 42 000 − 1 234.56 − 89.90 − 5 000 = 49 176.04 (the planned rent has not
// happened yet), savings 0 + 5 000 = 5 000. On 2026-03-31: main 49 176.04 − 3 000 = 46 176.04.
//
// Dashboard 3m: neither the transfer nor the opening balance counts, the December income falls outside, the planned
// rent inside. Income 42 000, expense 1 234.56 + 89.90 + 3 000 = 4 324.46, net 37 675.54. Categories by
// income + expense: Výplata 42 000, Bydlení 3 000, Jídlo 1 234.56, the one without a category last (89.90).
// Months: January 42 000 income, February nothing, March 4 324.46 expense.
// Dashboard 6m: the December income joins: income 43 000, net 38 675.54, December 1 000 income.

/** The server clock during the scenario: Wednesday 18 March 2026, 10:00 UTC. */
const NOW = '2026-03-18T10:00:00.000Z'
/** The end of the access tokens issued at `NOW`: `ACCESS_TTL_SECONDS` (15 minutes) later. */
const ACCESS_EXPIRY = '2026-03-18T10:15:00.000Z'
/** One second later: the access tokens of the login are no longer accepted. */
const AFTER_EXPIRY = '2026-03-18T10:15:01.000Z'

/** The user of the scenario. */
const FIRST: FakeUser = { sub: 'scenario-first', email: 'first@coffra.test', emailVerified: true }
/** The user who must see nothing of it. */
const SECOND: FakeUser = { sub: 'scenario-second', email: 'second@coffra.test', emailVerified: true }

/** What the app generates (an id, a token, a cursor): any string. Its value is checked by what later uses it. */
const GENERATED = expect.any(String) as string

/** The answer of the guard to a token it does not accept. */
const EXPIRED = { statusCode: 401, error: 'Unauthorized', message: 'Invalid or expired access token' }

type Scenario = ReturnType<typeof useScenarioApp>
type Accounts = { main: string; savings: string }
type Categories = { salary: string; housing: string; food: string }

/** What a login gives the scenario: who logged in and the session the app issued. */
type Session = { userId: string; tokens: TokenPair }

/**
 * The income and expenses of the ledger, in the order they are entered: the amount as typed and as the API returns
 * it (four decimal places).
 */
const LEDGER = [
  { type: 'income', amount: '1000', shown: '1000.0000', date: '2025-12-20', category: 'salary', note: null },
  { type: 'income', amount: '42000', shown: '42000.0000', date: '2026-01-15', category: 'salary', note: null },
  { type: 'expense', amount: '1234.56', shown: '1234.5600', date: '2026-03-02', category: 'food', note: null },
  { type: 'expense', amount: '89.90', shown: '89.9000', date: '2026-03-10', category: null, note: 'Parkování' },
  { type: 'expense', amount: '3000', shown: '3000.0000', date: '2026-03-25', category: 'housing', note: 'Nájem' },
] as const

/**
 * Logs `user` in through the identity provider in a new browser, as the scenario's client does: the app redirects to
 * the provider and sets the login cookie, the provider redirects back with a code, the callback issues the session.
 *
 * @param scenario - the app of the scenario
 * @param user - who the provider authenticates
 * @returns the id of the user the login created and the session it issued
 */
const logIn = async (scenario: Scenario, user: FakeUser): Promise<Session> => {
  const { issuer } = scenario.idp()
  scenario.idp().user = user
  const browser = scenario.browser()

  const start = await startLogin(browser)
  const authorizationUrl = new URL(start.authorizationUrl)
  expect(`${authorizationUrl.origin}${authorizationUrl.pathname}`).toBe(`${issuer}/auth`)
  expect(authorizationUrl.searchParams.get('client_id')).toBe(CLIENT_ID)
  expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(REDIRECT_URI)
  expect(start.response.headers['cache-control']).toBe('no-store')
  expect(start.checksCookie).toMatch(/^coffra_oidc_checks=.+/u)

  const response = await callback(browser, await authorize(start.authorizationUrl))

  expect(response.status, JSON.stringify(response.body)).toBe(200)
  expect(response.headers['cache-control']).toBe('no-store')
  expect(checksCookiePair(response), 'the login cookie is single use').toBe('coffra_oidc_checks=')
  expect(response.body).toStrictEqual({
    accessToken: GENERATED,
    refreshToken: GENERATED,
    expiresIn: ACCESS_TTL_SECONDS,
  })
  const tokens = response.body as TokenPair

  const users = await scenario.prisma().user.findMany({ where: { externalSubject: user.sub } })
  expect(users, 'one user per subject').toHaveLength(1)
  const userId = users[0]?.id ?? ''
  expect(claimsOf(tokens.accessToken).sub).toBe(userId)

  const me = await scenario.as(tokens.accessToken).get('/api/users/me')
  expect([me.status, me.body]).toStrictEqual([200, { id: userId, email: user.email }])

  return { userId, tokens }
}

/**
 * Opens the two accounts of the ledger.
 *
 * @param client - requests of the first user
 * @returns their ids
 */
const openAccounts = async (client: Client): Promise<Accounts> => {
  const main = await client.post('/api/accounts', {
    name: 'Běžný účet',
    type: 'bank',
    currency: 'CZK',
    openingBalance: '12500.50',
  })
  expect([main.status, main.body]).toStrictEqual([
    201,
    {
      id: GENERATED,
      name: 'Běžný účet',
      type: 'bank',
      currency: 'CZK',
      openingBalance: '12500.5000',
      balance: '12500.5000',
    },
  ])

  const savings = await client.post('/api/accounts', { name: 'Spoření', type: 'bank', currency: 'CZK' })
  expect([savings.status, savings.body]).toStrictEqual([
    201,
    {
      id: GENERATED,
      name: 'Spoření',
      type: 'bank',
      currency: 'CZK',
      openingBalance: '0.0000',
      balance: '0.0000',
    },
  ])

  return { main: (main.body as AccountView).id, savings: (savings.body as AccountView).id }
}

/**
 * Adds the three categories of the ledger.
 *
 * @param client - requests of the first user
 * @returns their ids
 */
const addCategories = async (client: Client): Promise<Categories> => {
  const add = async (name: string): Promise<string> => {
    const response = await client.post('/api/categories', { name })
    expect([response.status, response.body]).toStrictEqual([201, { id: GENERATED, name }])

    return (response.body as { id: string }).id
  }

  return { salary: await add('Výplata'), housing: await add('Bydlení'), food: await add('Jídlo') }
}

/**
 * Records the income and expenses of `LEDGER` on the main account.
 *
 * @param client - requests of the first user
 * @param accounts - the accounts of the first user
 * @param categories - the categories of the first user
 * @returns every transaction as the API returned it, in the order of `LEDGER`
 */
const recordLedger = async (client: Client, accounts: Accounts, categories: Categories): Promise<TransactionView[]> => {
  const recorded: TransactionView[] = []

  for (const row of LEDGER) {
    const categoryId = row.category === null ? null : categories[row.category]
    const response = await client.post('/api/transactions', {
      accountId: accounts.main,
      type: row.type,
      amount: row.amount,
      date: row.date,
      categoryId,
      note: row.note,
    })

    expect([response.status, response.body], `${row.type} of ${row.date}`).toStrictEqual([
      201,
      {
        id: GENERATED,
        accountId: accounts.main,
        type: row.type,
        amount: row.shown,
        date: row.date,
        note: row.note,
        categoryId,
        transferPairId: null,
        transferDirection: null,
      },
    ])
    recorded.push(response.body as TransactionView)
  }

  return recorded
}

/**
 * Moves 5 000 from the main account to the savings.
 *
 * @param client - requests of the first user
 * @param accounts - the accounts of the first user
 * @returns the pair id of the transfer
 */
const transferToSavings = async (client: Client, accounts: Accounts): Promise<string> => {
  const response = await client.post('/api/transfers', {
    fromAccountId: accounts.main,
    toAccountId: accounts.savings,
    amount: '5000',
    date: '2026-03-12',
    note: 'Na spoření',
  })

  expect([response.status, response.body]).toStrictEqual([
    201,
    {
      pairId: GENERATED,
      fromAccountId: accounts.main,
      toAccountId: accounts.savings,
      amount: '5000.0000',
      date: '2026-03-12',
      note: 'Na spoření',
    },
  ])

  return (response.body as { pairId: string }).pairId
}

/**
 * Pages through the transactions three at a time, newest first, and expects every row exactly once in the order of
 * `(date, createdAt, id)` descending. The clock stands still, so every row has the same `createdAt`: the two sides of
 * the transfer, the only rows of one day, follow their ids.
 *
 * @param scenario - the app of the scenario
 * @param client - requests of the first user
 * @param accounts - the accounts of the first user
 * @param ledger - the income and expenses as recorded, in the order of `LEDGER`
 * @param pairId - the pair id of the transfer
 */
const pageThroughTransactions = async (
  scenario: Scenario,
  client: Client,
  accounts: Accounts,
  ledger: TransactionView[],
  pairId: string,
): Promise<void> => {
  const [december, january, groceries, parking, rent] = ledger
  // The ids of the two sides from the database: the transfer API does not return them.
  const sides = await scenario.prisma().transaction.findMany({ where: { transferPairId: pairId } })
  const side = (direction: 'out' | 'in'): TransactionView => ({
    id: sides.find(({ transferDirection }) => transferDirection === direction)?.id ?? '',
    accountId: direction === 'out' ? accounts.main : accounts.savings,
    type: 'transfer',
    amount: '5000.0000',
    date: '2026-03-12',
    note: 'Na spoření',
    categoryId: null,
    transferPairId: pairId,
    transferDirection: direction,
  })
  const transfer = [side('out'), side('in')].toSorted((left, right) => (left.id < right.id ? 1 : -1))

  const first = await client.get('/api/transactions?limit=3')
  expect([first.status, first.body]).toStrictEqual([200, { items: [rent, ...transfer], nextCursor: GENERATED }])

  const cursor = encodeURIComponent((first.body as { nextCursor: string }).nextCursor)
  const second = await client.get(`/api/transactions?limit=3&cursor=${cursor}`)
  expect([second.status, second.body]).toStrictEqual([
    200,
    { items: [parking, groceries, january], nextCursor: GENERATED },
  ])

  const next = encodeURIComponent((second.body as { nextCursor: string }).nextCursor)
  const last = await client.get(`/api/transactions?limit=3&cursor=${next}`)
  expect([last.status, last.body]).toStrictEqual([200, { items: [december], nextCursor: null }])
}

/**
 * The accounts of the first user as `GET /api/accounts` lists them, by name.
 *
 * @param accounts - the accounts of the first user
 * @param main - the balance of the main account
 * @returns the expected list
 */
const accountList = (accounts: Accounts, main: string): AccountView[] => [
  {
    id: accounts.main,
    name: 'Běžný účet',
    type: 'bank',
    currency: 'CZK',
    openingBalance: '12500.5000',
    balance: main,
  },
  {
    id: accounts.savings,
    name: 'Spoření',
    type: 'bank',
    currency: 'CZK',
    openingBalance: '0.0000',
    balance: '5000.0000',
  },
]

/**
 * Reads the balances today and at the end of the month, when the planned rent has happened.
 *
 * @param client - requests of the first user
 * @param accounts - the accounts of the first user
 */
const readBalances = async (client: Client, accounts: Accounts): Promise<void> => {
  const today = await client.get('/api/accounts')
  expect([today.status, today.body]).toStrictEqual([200, accountList(accounts, '49176.0400')])

  const endOfMonth = await client.get(`/api/accounts/${accounts.main}?asOf=2026-03-31`)
  expect([endOfMonth.status, endOfMonth.body]).toStrictEqual([200, accountList(accounts, '46176.0400')[0]])
}

/**
 * A month of the trend without income or expense.
 *
 * @param month - `YYYY-MM`
 * @returns the month as the dashboard returns it
 */
const quietMonth = (month: string) => ({ month, income: '0.0000', expense: '0.0000', net: '0.0000' })

/**
 * Reads the dashboard of the last three months (the default) and of the last six.
 *
 * @param client - requests of the first user
 * @param categories - the categories of the first user
 */
const readDashboard = async (client: Client, categories: Categories): Promise<void> => {
  const otherCategories = [
    { categoryId: categories.housing, name: 'Bydlení', income: '0.0000', expense: '3000.0000', net: '-3000.0000' },
    { categoryId: categories.food, name: 'Jídlo', income: '0.0000', expense: '1234.5600', net: '-1234.5600' },
    { categoryId: null, name: null, income: '0.0000', expense: '89.9000', net: '-89.9000' },
  ]
  const january = { month: '2026-01', income: '42000.0000', expense: '0.0000', net: '42000.0000' }
  const march = { month: '2026-03', income: '0.0000', expense: '4324.4600', net: '-4324.4600' }

  const threeMonths = await client.get('/api/dashboard')
  expect([threeMonths.status, threeMonths.body]).toStrictEqual([
    200,
    {
      period: '3m',
      from: '2026-01-01',
      to: '2026-03-31',
      currencies: [
        {
          currency: 'CZK',
          income: '42000.0000',
          expense: '4324.4600',
          net: '37675.5400',
          categories: [
            {
              categoryId: categories.salary,
              name: 'Výplata',
              income: '42000.0000',
              expense: '0.0000',
              net: '42000.0000',
            },
            ...otherCategories,
          ],
          trend: [january, quietMonth('2026-02'), march],
        },
      ],
    },
  ])

  const sixMonths = await client.get('/api/dashboard?period=6m')
  expect([sixMonths.status, sixMonths.body]).toStrictEqual([
    200,
    {
      period: '6m',
      from: '2025-10-01',
      to: '2026-03-31',
      currencies: [
        {
          currency: 'CZK',
          income: '43000.0000',
          expense: '4324.4600',
          net: '38675.5400',
          categories: [
            {
              categoryId: categories.salary,
              name: 'Výplata',
              income: '43000.0000',
              expense: '0.0000',
              net: '43000.0000',
            },
            ...otherCategories,
          ],
          trend: [
            quietMonth('2025-10'),
            quietMonth('2025-11'),
            { month: '2025-12', income: '1000.0000', expense: '0.0000', net: '1000.0000' },
            january,
            quietMonth('2026-02'),
            march,
          ],
        },
      ],
    },
  ])
}

/**
 * Lets the access token of the login expire and renews the session with the refresh token.
 *
 * @param scenario - the app of the scenario
 * @param session - the session of the login
 * @param accounts - the accounts of the first user
 * @returns the renewed session
 */
const renewSession = async (scenario: Scenario, session: Session, accounts: Accounts): Promise<Session> => {
  expect(claimsOf(session.tokens.accessToken).exp).toBe(Date.parse(ACCESS_EXPIRY) / 1000)
  vi.setSystemTime(new Date(AFTER_EXPIRY))

  const expired = await scenario.as(session.tokens.accessToken).get('/api/accounts')
  expect([expired.status, expired.body]).toStrictEqual([401, EXPIRED])
  expect(expired.headers['www-authenticate']).toBe('Bearer')

  const refreshed = await scenario.anonymous().post('/api/auth/refresh', { refreshToken: session.tokens.refreshToken })
  expect([refreshed.status, refreshed.body]).toStrictEqual([
    200,
    { accessToken: GENERATED, refreshToken: GENERATED, expiresIn: ACCESS_TTL_SECONDS },
  ])
  expect(refreshed.headers['cache-control']).toBe('no-store')
  const tokens = refreshed.body as TokenPair
  expect(claimsOf(tokens.accessToken).sub).toBe(session.userId)
  expect(claimsOf(tokens.refreshToken).exp, 'the session ends when the one of the login would have').toBe(
    claimsOf(session.tokens.refreshToken).exp,
  )

  const renewed = await scenario.as(tokens.accessToken).get('/api/accounts')
  expect([renewed.status, renewed.body]).toStrictEqual([200, accountList(accounts, '49176.0400')])

  return { userId: session.userId, tokens }
}

/**
 * Logs out: the app hands out the end session URL of the provider and changes nothing.
 *
 * @param scenario - the app of the scenario
 */
const logOut = async (scenario: Scenario): Promise<void> => {
  const before = await scenario.snapshot()

  const response = await scenario.anonymous().post('/api/auth/logout')

  expect([response.status, response.body]).toStrictEqual([
    200,
    { endSessionUrl: `${scenario.idp().issuer}/logout?client_id=${CLIENT_ID}` },
  ])
  expect(await scenario.snapshot(), 'a logout writes nothing').toStrictEqual(before)
}

/**
 * The second user, logged in through the same provider, sees nothing of the first one: empty lists, an empty
 * dashboard, and the ids of the first user are not found.
 *
 * @param scenario - the app of the scenario
 * @param first - the session of the first user
 * @param accounts - the accounts of the first user
 * @param ledger - the income and expenses of the first user
 */
const secondUserSeesNothing = async (
  scenario: Scenario,
  first: Session,
  accounts: Accounts,
  ledger: TransactionView[],
): Promise<void> => {
  const second = await logIn(scenario, SECOND)
  expect(second.userId).not.toBe(first.userId)
  const client = scenario.as(second.tokens.accessToken)
  const emptyPage = { items: [], nextCursor: null }

  const reads: [string, unknown][] = [
    ['/api/accounts', []],
    ['/api/categories', []],
    ['/api/transactions', emptyPage],
    [`/api/transactions?accountId=${accounts.main}`, emptyPage],
    ['/api/dashboard', { period: '3m', from: '2026-01-01', to: '2026-03-31', currencies: [] }],
  ]
  for (const [path, body] of reads) {
    const response = await client.get(path)
    expect([response.status, response.body], path).toStrictEqual([200, body])
  }

  const account = await client.get(`/api/accounts/${accounts.main}`)
  expect([account.status, account.body]).toStrictEqual([
    404,
    { statusCode: 404, error: 'Not Found', message: 'Account not found' },
  ])

  const transaction = await client.get(`/api/transactions/${ledger[1]?.id ?? ''}`)
  expect([transaction.status, transaction.body]).toStrictEqual([
    404,
    { statusCode: 404, error: 'Not Found', message: 'Transaction not found' },
  ])
}

describe('the main flow of a user', () => {
  const scenario = useScenarioApp()

  it(
    'logs in, records the money, reads it back, renews the session and logs out; a second user sees none of it',
    { timeout: 30_000 },
    async () => {
      vi.useFakeTimers({ toFake: ['Date'], now: new Date(NOW) })
      expect(await scenario.snapshot(), 'the scenario starts from an empty database').toStrictEqual({
        users: [],
        accounts: [],
        categories: [],
        transactions: [],
      })

      const login = await logIn(scenario, FIRST)
      const client = scenario.as(login.tokens.accessToken)

      const accounts = await openAccounts(client)
      const categories = await addCategories(client)
      const ledger = await recordLedger(client, accounts, categories)
      const pairId = await transferToSavings(client, accounts)

      await pageThroughTransactions(scenario, client, accounts, ledger, pairId)
      await readBalances(client, accounts)
      await readDashboard(client, categories)

      const renewed = await renewSession(scenario, login, accounts)
      await logOut(scenario)

      await secondUserSeesNothing(scenario, renewed, accounts, ledger)

      // Everything that was written belongs to the first user; the second login only added its user.
      const { users, accounts: accountRows, categories: categoryRows, transactions } = await scenario.snapshot()
      expect(users.map(({ externalSubject }) => externalSubject).toSorted()).toStrictEqual([
        'scenario-first',
        'scenario-second',
      ])
      expect(accountRows.map(({ id, userId }) => [id, userId]).toSorted()).toStrictEqual(
        [
          [accounts.main, login.userId],
          [accounts.savings, login.userId],
        ].toSorted(),
      )
      expect(categoryRows.map(({ userId }) => userId)).toStrictEqual([login.userId, login.userId, login.userId])
      expect(transactions.map(({ accountId }) => accountId).toSorted()).toStrictEqual(
        [...Array.from({ length: 6 }, () => accounts.main), accounts.savings].toSorted(),
      )
    },
  )
})
