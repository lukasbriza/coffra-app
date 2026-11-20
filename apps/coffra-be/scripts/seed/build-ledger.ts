import { PLANNED_DAYS_AHEAD, SEED_MONTHS } from './constants'
import { ACCOUNTS, CATEGORIES, PLANNED_ENTRY, RECURRING_ENTRIES, RECURRING_TRANSFERS } from './demo-data'
import type { Ledger, LedgerEntry, LedgerTransfer } from './types'
import { addDays } from './utils/add-days'
import { dayInMonth } from './utils/day-in-month'
import { shiftMonth } from './utils/shift-month'
import { wholeAmount } from './utils/whole-amount'

/** The last day of the month the table uses, so every month has it. */
const LAST_TABLE_DAY = 28

/**
 * Makes the rows of the demo data for a day: the last `SEED_MONTHS` calendar months up to and including the month of
 * `today`, then one planned payment a few days after `today`.
 *
 * Pure and deterministic: the same day gives the same ledger, whatever the clock or the time zone. In the current month
 * only the days up to `today` are written, so nothing but the planned payment is dated in the future.
 *
 * @param today - the day the data is made for, `YYYY-MM-DD` (UTC)
 * @returns the accounts, categories, entries and transfers, referred to by name
 */
export const buildLedger = (today: string): Ledger => {
  const todayDay = Number(today.slice(8, 10))
  const months = Array.from({ length: SEED_MONTHS }, (_, index) => ({
    index,
    month: shiftMonth(today, index - (SEED_MONTHS - 1)),
    lastDay: index === SEED_MONTHS - 1 ? todayDay : LAST_TABLE_DAY,
  }))

  const entries: LedgerEntry[] = months.flatMap(({ index, month, lastDay }) =>
    RECURRING_ENTRIES.filter((item) => item.day <= lastDay && (item.when?.(index) ?? true)).map((item) => ({
      account: item.account,
      category: item.category,
      type: item.type,
      amount: wholeAmount(item.amount(index)),
      date: dayInMonth(month, item.day),
      note: item.note,
    })),
  )

  const transfers: LedgerTransfer[] = months.flatMap(({ month, lastDay }) =>
    RECURRING_TRANSFERS.filter((item) => item.day <= lastDay).map((item) => ({
      from: item.from,
      to: item.to,
      amount: wholeAmount(item.amount),
      date: dayInMonth(month, item.day),
      note: item.note,
    })),
  )

  return {
    from: dayInMonth(shiftMonth(today, -(SEED_MONTHS - 1)), 1),
    accounts: ACCOUNTS,
    categories: CATEGORIES,
    entries: [
      ...entries,
      {
        account: PLANNED_ENTRY.account,
        category: PLANNED_ENTRY.category,
        type: 'expense',
        amount: wholeAmount(PLANNED_ENTRY.amount),
        date: addDays(today, PLANNED_DAYS_AHEAD),
        note: PLANNED_ENTRY.note,
      },
    ],
    transfers,
  }
}
