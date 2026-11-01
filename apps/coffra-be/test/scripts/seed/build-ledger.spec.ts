import { describe, expect, it } from 'vitest'

import { buildLedger } from '../../../scripts/seed/build-ledger'
import type { Ledger, LedgerEntry } from '../../../scripts/seed/types'
import { formatIsoDate, parseIsoDate } from '../../../src/utils'
import { TIME_ZONES, useTimeZone } from '../../utils/use-time-zone'

/** `[today, first day of the oldest month, day of the planned payment]`, each worked out by hand. */
const DAYS: [string, string, string][] = [
  ['2026-10-30', '2025-11-01', '2026-11-02'],
  ['2026-10-15', '2025-11-01', '2026-10-18'],
  ['2026-10-01', '2025-11-01', '2026-10-04'],
  ['2026-03-31', '2025-04-01', '2026-04-03'],
  ['2024-02-29', '2023-03-01', '2024-03-03'],
  ['2026-01-01', '2025-02-01', '2026-01-04'],
  ['2025-01-31', '2024-02-01', '2025-02-03'],
  ['2026-12-31', '2026-01-01', '2027-01-03'],
]

/**
 * An amount of the ledger as a number (the seed writes whole amounts only).
 *
 * @param amount - a decimal string such as `12500.0000`
 * @returns the number
 */
const whole = (amount: string): number => Number(amount.slice(0, -5))

const total = (values: number[]): number => values.reduce((sum, value) => sum + value, 0)

const currencyOf = (ledger: Ledger, account: string): string | undefined =>
  ledger.accounts.find(({ name }) => name === account)?.currency

/** The entries that already happened (dated up to `today`), of one currency and type. */
const happened = (ledger: Ledger, today: string, currency: string, type: LedgerEntry['type']): LedgerEntry[] =>
  ledger.entries.filter(
    (entry) => entry.date <= today && entry.type === type && currencyOf(ledger, entry.account) === currency,
  )

/**
 * Every change of a balance up to `today`, in the worst order for a balance on one day: what takes money away first.
 *
 * @param ledger - the ledger
 * @param today - the day of the seed
 * @returns `[account, delta]` pairs in the order they are applied
 */
const movements = (ledger: Ledger, today: string): [string, number][] =>
  [
    ...ledger.entries
      .filter(({ date }) => date <= today)
      .map(({ account, type, amount, date }) => ({
        account,
        date,
        delta: type === 'income' ? whole(amount) : -whole(amount),
      })),
    ...ledger.transfers.flatMap(({ from, to, amount, date }) => [
      { account: from, date, delta: -whole(amount) },
      { account: to, date, delta: whole(amount) },
    ]),
  ]
    .toSorted((a, b) => a.date.localeCompare(b.date) || a.delta - b.delta)
    .map(({ account, delta }): [string, number] => [account, delta])

/**
 * The balance of every account on `today` and the lowest it ever was.
 *
 * @param ledger - the ledger
 * @param today - the day of the seed
 * @returns the balances by account name, and the lowest balance any account had
 */
const walk = (ledger: Ledger, today: string): { balances: Map<string, number>; lowest: number } => {
  const balances = new Map(ledger.accounts.map(({ name, openingBalance }) => [name, whole(openingBalance)]))
  let lowest = Math.min(...balances.values())

  for (const [account, delta] of movements(ledger, today)) {
    const balance = (balances.get(account) ?? 0) + delta

    balances.set(account, balance)
    lowest = Math.min(lowest, balance)
  }

  return { balances, lowest }
}

describe('buildLedger', () => {
  describe.each(TIME_ZONES)('with the server in %s', (zone, offset) => {
    useTimeZone(zone, offset)

    describe.each(DAYS)('for %s', (today, from, planned) => {
      it('gives the same ledger on every call', () => {
        expect(buildLedger(today)).toStrictEqual(buildLedger(today))
      })

      it('starts in the first month of the window and covers its twelve months', () => {
        const ledger = buildLedger(today)
        const months = new Set(
          [...ledger.entries, ...ledger.transfers]
            .filter(({ date }) => date <= today)
            .map(({ date }) => date.slice(0, 7)),
        )

        expect(ledger.from).toBe(from)
        expect(months).toContain(from.slice(0, 7))
        expect(months.size).toBeGreaterThanOrEqual(11)
        expect(months.size).toBeLessThanOrEqual(12)
        expect([...months].every((month) => month >= from.slice(0, 7))).toBe(true)
      })

      it('dates nothing after today but the one planned payment, three days ahead', () => {
        const ledger = buildLedger(today)
        const ahead = ledger.entries.filter(({ date }) => date > today)

        expect(ahead.map(({ date, type }) => [date, type])).toStrictEqual([[planned, 'expense']])
        expect(ledger.transfers.every(({ date }) => date <= today)).toBe(true)
        expect([...ledger.entries, ...ledger.transfers].every(({ date }) => date >= from)).toBe(true)
      })

      it('uses days that exist and positive amounts with four decimal places', () => {
        const ledger = buildLedger(today)
        const rows = [...ledger.entries, ...ledger.transfers]

        expect(rows.every(({ date }) => formatIsoDate(parseIsoDate(date)) === date)).toBe(true)
        expect(rows.every(({ amount }) => /^[1-9]\d*\.0000$/u.test(amount))).toBe(true)
      })

      it('refers only to accounts and categories it defines, and a transfer joins two accounts of one currency', () => {
        const ledger = buildLedger(today)
        const names = ledger.accounts.map(({ name }) => name)

        expect(new Set(names).size).toBe(names.length)
        expect(new Set(ledger.categories).size).toBe(ledger.categories.length)
        expect(ledger.entries.every(({ account }) => names.includes(account))).toBe(true)
        expect(ledger.entries.every(({ category }) => category === null || ledger.categories.includes(category))).toBe(
          true,
        )
        expect(
          ledger.transfers.every(({ from: out, to }) => out !== to && names.includes(out) && names.includes(to)),
        ).toBe(true)
        expect(ledger.transfers.every(({ from: out, to }) => currencyOf(ledger, out) === currencyOf(ledger, to))).toBe(
          true,
        )
      })

      it('never takes an account below zero', () => {
        const ledger = buildLedger(today)

        expect(walk(ledger, today).lowest).toBeGreaterThanOrEqual(0)
      })
    })

    describe('for 2026-10-30, with the numbers worked out by hand', () => {
      const today = '2026-10-30'

      it('writes 155 entries and 24 transfers, 203 rows with both sides of a transfer', () => {
        const ledger = buildLedger(today)

        expect(ledger.entries).toHaveLength(155)
        expect(ledger.transfers).toHaveLength(24)
        expect(ledger.entries.length + 2 * ledger.transfers.length).toBe(203)
      })

      it('earns 624 000 CZK and 3 200 EUR and spends 291 256 CZK and 1 070 EUR', () => {
        const ledger = buildLedger(today)
        const sum = (currency: string, type: LedgerEntry['type']): number =>
          total(happened(ledger, today, currency, type).map(({ amount }) => whole(amount)))

        expect([sum('CZK', 'income'), sum('CZK', 'expense')]).toStrictEqual([624_000, 291_256])
        expect([sum('EUR', 'income'), sum('EUR', 'expense')]).toStrictEqual([3200, 1070])
      })

      it('spends by category as the table says, 3 600 CZK of it on nothing in particular', () => {
        const ledger = buildLedger(today)
        const spent = (category: string | null): number =>
          total(
            happened(ledger, today, 'CZK', 'expense')
              .filter((entry) => entry.category === category)
              .map(({ amount }) => whole(amount)),
          )

        expect(
          ['Bydlení', 'Jídlo', 'Zábava', 'Doprava', 'Předplatná', 'Zdraví', null].map((category) => spent(category)),
        ).toStrictEqual([201_600, 64_440, 9400, 6600, 3936, 1680, 3600])
      })

      it('has the balances of the four accounts on the day', () => {
        const { balances } = walk(buildLedger(today), today)

        expect(Object.fromEntries(balances)).toStrictEqual({
          'Běžný účet': 214_744,
          'Spořicí účet': 220_000,
          Hotovost: 26_000,
          'Euro účet': 2630,
        })
      })

      it.each([
        ['2025-11', 24_298],
        ['2026-05', 25_398],
        ['2026-10', 23_878],
      ])('spends %s the amount of its month, and earns the salary', (month, expense) => {
        const ledger = buildLedger(today)
        const of = (type: LedgerEntry['type']): number =>
          total(
            happened(ledger, today, 'CZK', type)
              .filter(({ date }) => date.startsWith(month))
              .map(({ amount }) => whole(amount)),
          )

        expect([of('income'), of('expense')]).toStrictEqual([52_000, expense])
      })
    })

    describe('for 2026-10-15, in the middle of the month', () => {
      const today = '2026-10-15'

      it('writes 151 entries and 24 transfers: of this month only the days up to the 15th', () => {
        const ledger = buildLedger(today)

        expect(ledger.entries).toHaveLength(151)
        expect(ledger.transfers).toHaveLength(24)
      })

      it('spends 15 000 on transport over the window, the planned 8 400 included', () => {
        const ledger = buildLedger(today)

        expect(
          total(ledger.entries.filter(({ category }) => category === 'Doprava').map(({ amount }) => whole(amount))),
        ).toBe(15_000)
      })

      it('leaves the balance of today as it is without the planned payment', () => {
        const ledger = buildLedger(today)
        const withoutPlanned: Ledger = { ...ledger, entries: ledger.entries.filter(({ date }) => date <= today) }

        expect(walk(ledger, today).balances).toStrictEqual(walk(withoutPlanned, today).balances)
      })
    })

    describe('for 2026-10-01, the first day of the month', () => {
      it('has nothing of the current month but the planned payment', () => {
        const ledger = buildLedger('2026-10-01')

        expect(ledger.entries.filter(({ date }) => date.startsWith('2026-10')).map(({ date }) => date)).toStrictEqual([
          '2026-10-04',
        ])
        expect(ledger.transfers.filter(({ date }) => date.startsWith('2026-10'))).toStrictEqual([])
      })
    })
  })
})
