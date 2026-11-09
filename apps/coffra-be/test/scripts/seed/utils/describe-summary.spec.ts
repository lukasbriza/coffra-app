import { describe, expect, it } from 'vitest'

import { describeSummary } from '../../../../scripts/seed/utils/describe-summary'

describe('describeSummary', () => {
  it('says what was written and what it replaced', () => {
    expect(
      describeSummary({
        userId: 'user-1',
        from: '2025-11-01',
        today: '2026-10-30',
        accounts: 4,
        categories: 9,
        transactions: 203,
        transfers: 24,
        removed: { accounts: 3, categories: 2, transactions: 10 },
      }),
    ).toBe(
      'Seeded dev@coffra.local (user user-1) for 2026-10-30: 4 accounts, 9 categories and 203 transactions ' +
        '(24 of them transfers) from 2025-11-01. Replaced 3 accounts, 2 categories and 10 transactions.',
    )
  })
})
