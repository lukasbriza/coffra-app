/** The periods the dashboard offers, as the client spells them: the last 3 months, 6 months or a year. */
export const PERIODS = ['3m', '6m', '1y'] as const

/** The period used when the request does not name one. */
export const DEFAULT_PERIOD = '3m'

/** How many calendar months, the current one included, each period covers. */
export const PERIOD_MONTHS = { '3m': 3, '6m': 6, '1y': 12 } as const
