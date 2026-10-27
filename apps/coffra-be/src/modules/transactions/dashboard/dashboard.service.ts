import { Inject, Injectable } from '@nestjs/common'

import { formatIsoDate } from '../../../utils'
import type { Owner } from '../../core'
import { TransactionTotalsService } from '../totals/totals.service'

import { DEFAULT_PERIOD } from './constants'
import { toDashboardView } from './dashboard.mapper'
import type { DashboardQuery, DashboardView } from './dashboard.types'
import { foldMonths } from './utils/fold-months'
import { periodWindow } from './utils/period-window'
import { summarizeTotals } from './utils/summarize-totals'
import { windowMonths } from './utils/window-months'

/**
 * The dashboard of one owner: what came in and what went out in the last months, per currency, category and month.
 *
 * It reads the transactions only through {@link TransactionTotalsService}, which applies the owner scope, so a
 * transaction of somebody else is never counted. What it decides itself is which days the period covers and how the
 * totals are laid out.
 */
@Injectable()
export class DashboardService {
  constructor(@Inject(TransactionTotalsService) private readonly totals: TransactionTotalsService) {}

  /**
   * Adds up the income and the expense of the owner over a period.
   *
   * The window is made of whole calendar months in UTC, counted from today: the current month and the ones before it.
   * Everything dated in the window counts, a planned transaction later this month included. Transfers and the opening
   * balance of an account never count.
   *
   * The categories and the months come from two reads of the totals service, so a transaction written between them can
   * be in one and not in the other. The currencies are those of the categories; the months of any other currency are
   * left out, and a currency without a day has zeros in every month.
   *
   * @param owner - whose transactions to add up
   * @param query - the period; `3m` when left out
   * @returns the totals per currency with their categories and months; no currencies when nothing falls in the window
   */
  async get(owner: Owner, { period = DEFAULT_PERIOD }: DashboardQuery): Promise<DashboardView> {
    // 1. Which days does the period cover? Today is the UTC day, like in every date of the API. The clock is read once,
    // so both reads below ask for the same days.
    const window = periodWindow(period, formatIsoDate(new Date()))

    // 2. The totals per currency and category, and the totals per currency and day, over those days. They do not depend
    // on each other, so both are read at once.
    const [rows, days] = await Promise.all([
      this.totals.categoryTotals(owner, window),
      this.totals.dailyTotals(owner, window),
    ])

    // 3. Spread the days over the months of the window, for the currencies that have a category row.
    const trends = foldMonths(days, windowMonths(window), [...new Set(rows.map(({ currency }) => currency))])

    // 4. Lay them out for the dashboard and write the amounts as strings.
    return toDashboardView(period, window, summarizeTotals(rows, trends))
  }
}
