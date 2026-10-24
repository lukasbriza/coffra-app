import 'reflect-metadata'

import { plainToInstance } from 'class-transformer'
import { IsIn, IsOptional, validate } from 'class-validator'
import { describe, expect, it } from 'vitest'

import { LIST_ORDERS } from '../../../../../src/modules/transactions/transactions/constants'
import { IsListCursor } from '../../../../../src/modules/transactions/transactions/decorators/is-list-cursor.decorator'
import { encodeListCursor } from '../../../../../src/modules/transactions/transactions/transactions.cursor'

// As the list query declares it: an `order` with a default next to an optional cursor.
class Probe {
  @IsIn(LIST_ORDERS)
  order: unknown = 'desc'

  @IsOptional()
  @IsListCursor()
  cursor?: unknown
}

const KEY = {
  date: new Date('2026-10-19T00:00:00.000Z'),
  createdAt: new Date('2026-10-19T08:00:00.123Z'),
  id: '9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d',
}

const check = async (query: Record<string, unknown>): Promise<{ cursor: unknown; errors: string[] }> => {
  const probe = plainToInstance(Probe, query)
  const errors = await validate(probe)
  return { cursor: probe.cursor, errors: errors.flatMap((error) => Object.values(error.constraints ?? {})) }
}

describe('@IsListCursor()', () => {
  it('decodes a cursor of the list to the position it stands for', async () => {
    await expect(check({ cursor: encodeListCursor(KEY, 'desc') })).resolves.toStrictEqual({
      cursor: { order: 'desc', date: '2026-10-19', createdAt: '2026-10-19T08:00:00.123Z', id: KEY.id },
      errors: [],
    })
  })

  it('accepts a cursor of an asc list next to order=asc', async () => {
    await expect(check({ order: 'asc', cursor: encodeListCursor(KEY, 'asc') })).resolves.toMatchObject({ errors: [] })
  })

  it('accepts no cursor: the first page', async () => {
    await expect(check({})).resolves.toStrictEqual({ cursor: undefined, errors: [] })
  })

  it.each([
    ['garbage', 'abc+/'],
    ['the empty string', ''],
    ['a repeated parameter', [encodeListCursor(KEY, 'desc'), encodeListCursor(KEY, 'desc')]],
  ])('refuses %s and leaves it as it came', async (_name, cursor) => {
    await expect(check({ cursor })).resolves.toStrictEqual({
      cursor,
      errors: ['cursor must be the nextCursor of a previous page, as it came'],
    })
  })

  it.each([
    ['a cursor of a desc list with order=asc', 'asc', 'desc'],
    ['a cursor of an asc list with order=desc', 'desc', 'asc'],
    ['a cursor of an asc list with the default order', undefined, 'asc'],
  ])('refuses %s', async (_name, order, issuedFor) => {
    const query = { cursor: encodeListCursor(KEY, issuedFor as 'asc' | 'desc'), ...(order ? { order } : {}) }

    await expect(check(query)).resolves.toMatchObject({ errors: ['cursor was issued for the other order'] })
  })

  it('leaves an invalid order to its own check, once', async () => {
    const { errors } = await check({ order: 'ASC', cursor: encodeListCursor(KEY, 'asc') })

    expect(errors).toEqual(['order must be one of the following values: desc, asc'])
  })
})
