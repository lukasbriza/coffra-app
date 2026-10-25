import { describe, expect, it } from 'vitest'

import { Prisma, TransactionType, TransferDirection } from '../../../../src/modules/prisma'
import { balanceOf } from '../../../../src/modules/transactions/accounts/accounts.balance'
import type { BalanceTotal } from '../../../../src/modules/transactions/accounts/accounts.types'

const total = (
  type: TransactionType,
  amount: string,
  transferDirection: TransferDirection | null = null,
): BalanceTotal => ({ type, transferDirection, total: new Prisma.Decimal(amount) })

const income = (amount: string) => total(TransactionType.income, amount)
const expense = (amount: string) => total(TransactionType.expense, amount)
const incoming = (amount: string) => total(TransactionType.transfer, amount, TransferDirection.in)
const outgoing = (amount: string) => total(TransactionType.transfer, amount, TransferDirection.out)

const balance = (opening: string, totals: BalanceTotal[]): string =>
  balanceOf(new Prisma.Decimal(opening), totals).toFixed(4)

describe('balanceOf', () => {
  it('is the opening balance for an account without transactions', () => {
    expect(balance('1250.5', [])).toBe('1250.5000')
    expect(balance('-20', [])).toBe('-20.0000')
    expect(balance('0', [])).toBe('0.0000')
  })

  it.each([
    ['adds income', income('100'), '1100.0000'],
    ['takes expenses', expense('100'), '900.0000'],
    ['adds an incoming transfer', incoming('100'), '1100.0000'],
    ['takes an outgoing transfer', outgoing('100'), '900.0000'],
  ])('%s to the opening balance', (_name, one, expected) => {
    expect(balance('1000', [one])).toBe(expected)
  })

  it('adds up a mix of all four kinds', () => {
    // 1000.50 + 5000.30 - 1200.25 + 300 - 100
    expect(balance('1000.5', [income('5000.3'), expense('1200.25'), incoming('300'), outgoing('100')])).toBe(
      '5000.5500',
    )
  })

  it('counts the opening balance once, and never as income', () => {
    expect(balance('1000', [income('0.0001')])).toBe('1000.0001')
    expect(balance('1000', [expense('1000')])).toBe('0.0000')
  })

  it('does not depend on the order of the totals', () => {
    const totals = [income('5000.3'), expense('1200.25'), incoming('300'), outgoing('100')]

    expect(balance('1000.5', totals.toReversed())).toBe(balance('1000.5', totals))
  })

  it('goes below zero: a negative opening balance, or more spent than there is', () => {
    expect(balance('-200', [income('50')])).toBe('-150.0000')
    expect(balance('100', [expense('250.5')])).toBe('-150.5000')
  })

  it('is exact where a floating point number is not', () => {
    expect(balance('0', [income('0.1'), income('0.2')])).toBe('0.3000')
    expect(balance('0.1', [income('0.2')])).toBe('0.3000')
  })

  it('keeps every digit of a sum beyond the 20 significant digits of the default decimal', () => {
    // 20 x 999999999999999.9999 has 21 significant digits at four decimal places.
    expect(balance('0', [income('19999999999999999.998')])).toBe('19999999999999999.9980')
    expect(
      balance(
        '999999999999999.9999',
        Array.from({ length: 19 }, () => income('999999999999999.9999')),
      ),
    ).toBe('19999999999999999.9980')
  })

  it('does not change what it was given', () => {
    const opening = new Prisma.Decimal('1000')
    const totals = [income('5')]

    balanceOf(opening, totals)

    expect(opening.toFixed(4)).toBe('1000.0000')
    expect(totals[0]?.total.toFixed(4)).toBe('5.0000')
  })

  it('refuses a transfer total without a direction: the database cannot hold such a row', () => {
    expect(() => balanceOf(new Prisma.Decimal(0), [total(TransactionType.transfer, '10')])).toThrow(
      'A transfer total has no direction',
    )
  })
})
