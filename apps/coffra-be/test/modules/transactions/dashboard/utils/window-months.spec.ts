import { describe, expect, it } from 'vitest'

import { PERIOD_MONTHS, PERIODS } from '../../../../../src/modules/transactions/dashboard/constants'
import { periodWindow } from '../../../../../src/modules/transactions/dashboard/utils/period-window'
import { windowMonths } from '../../../../../src/modules/transactions/dashboard/utils/window-months'
import { parseIsoDate } from '../../../../../src/utils'

/** The month after `month` (`YYYY-MM`), from a source that knows the calendar (`Date`). */
const nextMonth = (month: string): string => {
  const [year = 0, number = 0] = month.split('-').map(Number)

  // `number` is 1-based and `Date.UTC` wants 0-based, so passing it as is gives the following month.
  return new Date(Date.UTC(year, number, 1)).toISOString().slice(0, 7)
}

describe('windowMonths', () => {
  it.each<[from: string, to: string, months: string[]]>([
    ['2026-08-01', '2026-10-31', ['2026-08', '2026-09', '2026-10']],
    // A window of one month is that month.
    ['2026-10-01', '2026-10-31', ['2026-10']],
    // The turn of the year.
    ['2025-11-01', '2026-01-31', ['2025-11', '2025-12', '2026-01']],
    ['2025-12-01', '2026-02-28', ['2025-12', '2026-01', '2026-02']],
    // February of a leap year and of a year that is not.
    ['2023-12-01', '2024-02-29', ['2023-12', '2024-01', '2024-02']],
    ['2100-01-01', '2100-03-31', ['2100-01', '2100-02', '2100-03']],
    // The days of the window do not matter, only their months.
    ['2026-08-17', '2026-09-03', ['2026-08', '2026-09']],
    // Nothing between a first month that is later than the last.
    ['2026-11-01', '2026-10-31', []],
  ])('lists the months of %s .. %s', (from, to, months) => {
    expect(windowMonths({ from, to })).toStrictEqual(months)
  })

  it('lists a year as its twelve months, the oldest first', () => {
    expect(windowMonths({ from: '2025-11-01', to: '2026-10-31' })).toStrictEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
      '2026-10',
    ])
  })

  it('writes the year with four digits and the month with two', () => {
    expect(windowMonths({ from: '0099-11-01', to: '0100-01-31' })).toStrictEqual(['0099-11', '0099-12', '0100-01'])
  })

  describe('for the window of every period on every day of seven years', () => {
    /** Every day from 2023-01-01 to 2029-12-31, which holds the leap years 2024 and 2028. */
    const days: string[] = []

    for (
      let time = parseIsoDate('2023-01-01').getTime();
      time <= parseIsoDate('2029-12-31').getTime();
      time += 86_400_000
    ) {
      days.push(new Date(time).toISOString().slice(0, 10))
    }

    it.each(PERIODS)('the period %s has exactly the months it names, ending in the month of today', (period) => {
      for (const today of days) {
        const months = windowMonths(periodWindow(period, today))

        expect(months, today).toHaveLength(PERIOD_MONTHS[period])
        expect(months.at(-1), today).toBe(today.slice(0, 7))
      }
    })

    it.each(PERIODS)('the period %s has months that follow one another with none missing or repeated', (period) => {
      for (const today of days) {
        const months = windowMonths(periodWindow(period, today))

        expect(
          months.slice(1).every((month, index) => month === nextMonth(months[index] ?? '')),
          today,
        ).toBe(true)
      }
    })
  })
})
