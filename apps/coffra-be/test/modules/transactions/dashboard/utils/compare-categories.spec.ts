import { describe, expect, it } from 'vitest'

import { Money } from '../../../../../src/modules/transactions/common/money'
import type { CategorySummary } from '../../../../../src/modules/transactions/dashboard/dashboard.types'
import { compareCategories } from '../../../../../src/modules/transactions/dashboard/utils/compare-categories'

const FOOD = '11111111-1111-4111-8111-111111111111'
const SALARY = '33333333-3333-4333-8333-333333333333'

/** A category with the given id (`null` for the transactions without one) and amounts; the name and the net follow. */
const category = (categoryId: string | null, income: string, expense: string): CategorySummary => ({
  categoryId,
  name: categoryId === null ? null : 'Name',
  income: new Money(income),
  expense: new Money(expense),
  net: new Money(income).minus(expense),
})

describe('compareCategories', () => {
  it('puts the category with more money moved first', () => {
    const small = category(FOOD, '0', '100')
    const large = category(SALARY, '500', '0')

    expect(compareCategories(large, small)).toBeLessThan(0)
    expect(compareCategories(small, large)).toBeGreaterThan(0)
  })

  it('sizes a category by income plus expense, not by one of them or by the net', () => {
    const busy = category(FOOD, '60', '60')
    const earner = category(SALARY, '100', '0')

    // The net of `busy` is 0 and its income is lower than 100, but 120 > 100 moved.
    expect(compareCategories(busy, earner)).toBeLessThan(0)
  })

  it('compares categories of the same size as equal', () => {
    expect(compareCategories(category(FOOD, '30', '70'), category(SALARY, '100', '0'))).toBe(0)
  })

  it('puts the transactions without a category last, however large they are', () => {
    const none = category(null, '1000000', '1000000')
    const named = category(FOOD, '1', '0')

    expect(compareCategories(none, named)).toBeGreaterThan(0)
    expect(compareCategories(named, none)).toBeLessThan(0)
  })

  it('compares two rows without a category as equal', () => {
    expect(compareCategories(category(null, '1', '0'), category(null, '2', '0'))).toBe(0)
  })

  it('tells the size apart where only the digits beyond the 20th differ', () => {
    const more = category(FOOD, '19999999999999999.9981', '0')
    const less = category(SALARY, '19999999999999999.9980', '0')

    expect(compareCategories(more, less)).toBeLessThan(0)
  })

  it('keeps the order of equal categories when used to sort', () => {
    const first = category(FOOD, '10', '0')
    const second = category(SALARY, '0', '10')

    expect([first, second].toSorted(compareCategories)).toStrictEqual([first, second])
    expect([second, first].toSorted(compareCategories)).toStrictEqual([second, first])
  })
})
