import 'reflect-metadata'

import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'

import { IsIsoDate } from '../../../../../src/modules/transactions/common/decorators/is-iso-date.decorator'

class Probe {
  @IsIsoDate()
  date!: unknown
}

const errorsOf = async (date: unknown): Promise<string[]> => {
  const errors = await validate(plainToInstance(Probe, { date }))
  return errors.flatMap((error) => Object.values(error.constraints ?? {}))
}

describe('@IsIsoDate()', () => {
  it.each(['2026-10-19', '2024-02-29', '2000-02-29', '2026-12-31', '0001-01-01', '0050-06-15', '9999-12-31'])(
    'accepts %j',
    async (date) => {
      await expect(errorsOf(date)).resolves.toEqual([])
    },
  )

  it.each([
    ['a day after the end of February', '2026-02-30'],
    ['29 February outside a leap year', '2026-02-29'],
    ['29 February of a century that is not a leap year', '1900-02-29'],
    ['31 April', '2026-04-31'],
    ['month 13', '2026-13-01'],
    ['month 0', '2026-00-10'],
    ['day 0', '2026-10-00'],
    ['day 32', '2026-10-32'],
    ['year 0, which Postgres does not have', '0000-01-01'],
    ['a year of five digits', '10000-01-01'],
    ['no leading zeros', '2026-1-5'],
    ['a time', '2026-10-19T00:00:00'],
    ['a time in UTC', '2026-10-19T00:00:00Z'],
    ['a time zone offset', '2026-10-19+02:00'],
    ['slashes', '2026/10/19'],
    ['the day first', '19.10.2026'],
    ['spaces', ' 2026-10-19'],
    ['a trailing newline', '2026-10-19\n'],
    ['the empty string', ''],
    ['a timestamp number', 1_792_368_000_000],
    ['a Date object', new Date('2026-10-19T00:00:00Z')],
    ['null', null],
    ['undefined', undefined],
  ])('refuses %s', async (_name, date) => {
    await expect(errorsOf(date)).resolves.toEqual(['date must be a calendar date YYYY-MM-DD'])
  })
})
