import { describe, expect, it, vi } from 'vitest'

import { TransactionType } from '../../../src/modules/prisma'
import { parseIsoDate } from '../../../src/utils'
import { useTimeZone } from '../../utils/use-time-zone'
import { balancesOf, sqlBalances } from '../support/responses'
import { useIntegrationApp } from '../support/use-integration-app'
import type { Persona } from '../support/world'

const ZONES: [zone: string, offset: number][] = [
  ['Pacific/Kiritimati', -840],
  ['Pacific/Pago_Pago', 660],
]

/** A day and the day before it: a leap day, the summer time switches in Prague, the last day of the range. */
const DAYS: [day: string, dayBefore: string][] = [
  ['2024-02-29', '2024-02-28'],
  ['2026-03-29', '2026-03-28'],
  ['2026-10-25', '2026-10-24'],
  ['9999-12-31', '9999-12-30'],
]

// The balance of an account through a real `DATE` column and a real `SUM`: `asOf` counts its whole day in every time
// zone of the server, "today" is the UTC day of the clock, and large sums keep every digit.
describe('balances through the database', () => {
  const { as, world, prisma, issueToken } = useIntegrationApp()

  /** The balance of one account, from its detail and from the list (both must agree). */
  const balanceOf = async (persona: Pick<Persona, 'token'>, accountId: string, query = ''): Promise<string> => {
    const detail = await as(persona).get(`/api/accounts/${accountId}${query}`).expect(200)
    const list = await as(persona).get(`/api/accounts${query}`).expect(200)
    const balance = (detail.body as { balance: string }).balance

    expect(balancesOf(list.body)[accountId]).toBe(balance)

    return balance
  }

  /** Writes an income of 100 on the empty account of `a` (opening balance 42). */
  const incomeOn = async (persona: Persona, date: string): Promise<void> => {
    await as(persona)
      .post('/api/transactions', { accountId: persona.accounts.empty, type: 'income', amount: '100', date })
      .expect(201)
  }

  describe.each(ZONES)('asOf with the server in %s', (zone, offset) => {
    useTimeZone(zone, offset)

    it.each(DAYS)('counts a transaction of %s from that very day on', async (day, dayBefore) => {
      const { a } = world()
      await incomeOn(a, day)

      expect(await balanceOf(a, a.accounts.empty, `?asOf=${day}`)).toBe('142.0000')
      expect(await balanceOf(a, a.accounts.empty, `?asOf=${dayBefore}`)).toBe('42.0000')
    })
  })

  describe('today', () => {
    it.each([
      ['Pacific/Kiritimati', -840, '2026-10-24T23:59:59.999Z', '42.0000'],
      ['Pacific/Kiritimati', -840, '2026-10-25T00:00:00.000Z', '142.0000'],
      ['Pacific/Pago_Pago', 660, '2026-10-24T23:59:59.999Z', '42.0000'],
      ['Pacific/Pago_Pago', 660, '2026-10-25T00:00:00.000Z', '142.0000'],
    ])('is the UTC day of the clock in %s (offset %i) at %s', async (zone, offset, now, balance) => {
      const { a } = world()
      await incomeOn(a, '2026-10-25')
      vi.stubEnv('TZ', zone)
      expect(new Date('2026-01-15T12:00:00Z').getTimezoneOffset()).toBe(offset)
      vi.useFakeTimers({ toFake: ['Date'], now: new Date(now) })

      // The token of the seed was signed with the real clock: sign one with the moved clock.
      const persona = { token: await issueToken(a.userId) }

      expect(await balanceOf(persona, a.accounts.empty)).toBe(balance)
    })
  })

  describe('precision', () => {
    it('adds up more than 20 significant digits exactly', async () => {
      const { a } = world()
      // Postgres sums the transactions; the app adds the opening balance to that sum. With a last decimal place in the
      // opening balance, that addition needs 21 significant digits.
      await prisma().account.update({ where: { id: a.accounts.empty }, data: { openingBalance: '0.0001' } })
      await prisma().transaction.createMany({
        data: Array.from({ length: 20 }, () => ({
          accountId: a.accounts.empty,
          type: TransactionType.income,
          amount: '999999999999999.9999',
          date: parseIsoDate('2026-01-20'),
        })),
      })

      // 0.0001 + 20 × 999999999999999.9999: 21 significant digits, one more than the default precision of `Prisma.Decimal`.
      const independent = await sqlBalances(prisma(), a.userId, '2026-01-20')

      expect(await balanceOf(a, a.accounts.empty)).toBe('19999999999999999.9981')
      expect(independent[a.accounts.empty]).toBe('19999999999999999.9981')
    })

    it('adds decimal fractions without binary rounding', async () => {
      const { a } = world()
      for (const amount of ['0.1', '0.2']) {
        await as(a)
          .post('/api/transactions', { accountId: a.accounts.empty, type: 'income', amount, date: '2026-01-20' })
          .expect(201)
      }

      expect(await balanceOf(a, a.accounts.empty)).toBe('42.3000')
    })
  })
})
