import type { LedgerAccount, PlannedEntry, RecurringEntry, RecurringTransfer } from './types'
import { wholeAmount } from './utils/whole-amount'

// The demo data as a table: what the demo user owns and what repeats every month. `buildLedger` turns it into rows for
// a day. Names are the references between the parts, so a name used here must be defined below.

const MAIN = 'Běžný účet'
const SAVINGS = 'Spořicí účet'
const CASH = 'Hotovost'
const EURO = 'Euro účet'

const SALARY = 'Mzda'
const HOUSING = 'Bydlení'
const FOOD = 'Jídlo'
const TRANSPORT = 'Doprava'
const FUN = 'Zábava'
const HEALTH = 'Zdraví'
const SUBSCRIPTIONS = 'Předplatná'
const SIDE_INCOME = 'Vedlejší příjem'
const TRAVEL = 'Cestování'

/** Added to the last grocery shopping of the month with this index (`0` is the oldest month): the months differ. */
const GROCERY_EXTRA = [0, 120, 0, 340, 80, 0, 200, 460, 0, 150, 90, 0]

/** Added to the restaurant bill of the month with this index. */
const FUN_EXTRA = [0, 300, 0, 0, 150, 0, 900, 0, 0, 250, 0, 0]

/**
 * A fixed amount for every month.
 *
 * @param value - the amount
 * @returns a function giving it whatever the month
 */
const fixed = (value: number) => (): number => value

/** The accounts of the demo user: three in CZK (a transfer needs two of one currency) and one in EUR. */
export const ACCOUNTS: readonly LedgerAccount[] = [
  { name: MAIN, type: 'bank', currency: 'CZK', openingBalance: wholeAmount(25_000) },
  { name: SAVINGS, type: 'bank', currency: 'CZK', openingBalance: wholeAmount(100_000) },
  { name: CASH, type: 'cash', currency: 'CZK', openingBalance: wholeAmount(3000) },
  { name: EURO, type: 'bank', currency: 'EUR', openingBalance: wholeAmount(500) },
]

/** The categories of the demo user. */
export const CATEGORIES: readonly string[] = [
  SALARY,
  HOUSING,
  FOOD,
  TRANSPORT,
  FUN,
  HEALTH,
  SUBSCRIPTIONS,
  SIDE_INCOME,
  TRAVEL,
]

/** Incomes and expenses that come every month, or in the months `when` picks. */
export const RECURRING_ENTRIES: readonly RecurringEntry[] = [
  { account: MAIN, category: SALARY, type: 'income', day: 5, note: 'Výplata', amount: fixed(52_000) },
  { account: MAIN, category: HOUSING, type: 'expense', day: 3, note: 'Nájem', amount: fixed(14_500) },
  { account: MAIN, category: HOUSING, type: 'expense', day: 8, note: 'Energie', amount: fixed(2300) },
  { account: MAIN, category: FOOD, type: 'expense', day: 6, note: 'Nákup potravin', amount: fixed(1450) },
  { account: MAIN, category: FOOD, type: 'expense', day: 13, note: 'Nákup potravin', amount: fixed(980) },
  { account: MAIN, category: FOOD, type: 'expense', day: 20, note: 'Nákup potravin', amount: fixed(1720) },
  {
    account: MAIN,
    category: FOOD,
    type: 'expense',
    day: 27,
    note: 'Velký nákup potravin',
    amount: (index) => 1100 + GROCERY_EXTRA[index],
  },
  { account: MAIN, category: TRANSPORT, type: 'expense', day: 2, note: 'Měsíční jízdné', amount: fixed(550) },
  { account: MAIN, category: SUBSCRIPTIONS, type: 'expense', day: 12, note: 'Streaming', amount: fixed(199) },
  { account: MAIN, category: SUBSCRIPTIONS, type: 'expense', day: 15, note: 'Hudba', amount: fixed(129) },
  {
    account: MAIN,
    category: HEALTH,
    type: 'expense',
    day: 22,
    note: 'Lékárna',
    amount: fixed(420),
    when: (index) => index % 3 === 0,
  },
  {
    account: CASH,
    category: FUN,
    type: 'expense',
    day: 18,
    note: 'Restaurace',
    amount: (index) => 650 + FUN_EXTRA[index],
  },
  { account: CASH, category: null, type: 'expense', day: 24, note: 'Drobný nákup', amount: fixed(300) },
  {
    account: EURO,
    category: SIDE_INCOME,
    type: 'income',
    day: 15,
    note: 'Faktura',
    amount: fixed(800),
    when: (index) => index % 3 === 2,
  },
  {
    account: EURO,
    category: TRAVEL,
    type: 'expense',
    day: 15,
    note: 'Dovolená',
    amount: (index) => (index === 4 ? 450 : 620),
    when: (index) => index === 4 || index === 9,
  },
]

/** Transfers that come every month. */
export const RECURRING_TRANSFERS: readonly RecurringTransfer[] = [
  { from: MAIN, to: SAVINGS, day: 6, amount: 10_000, note: 'Spoření' },
  { from: MAIN, to: CASH, day: 10, amount: 3000, note: 'Výběr z bankomatu' },
]

/** The one planned payment, dated a few days after the day of the seed. */
export const PLANNED_ENTRY: PlannedEntry = {
  account: MAIN,
  category: TRANSPORT,
  amount: 8400,
  note: 'Pojištění auta (plánovaná platba)',
}
