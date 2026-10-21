import 'reflect-metadata'

import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'

import { IsQueryInteger } from '../../../../../src/modules/transactions/common/decorators/is-query-integer.decorator'

class Probe {
  @IsQueryInteger(1, 100)
  limit: unknown = 50
}

const check = async (limit?: unknown): Promise<{ limit: unknown; errors: string[] }> => {
  const probe = plainToInstance(Probe, limit === undefined ? {} : { limit })
  const errors = await validate(probe)
  return { limit: probe.limit, errors: errors.flatMap((error) => Object.values(error.constraints ?? {})) }
}

describe('@IsQueryInteger()', () => {
  it.each([
    ['1', 1],
    ['7', 7],
    ['50', 50],
    ['100', 100],
  ])('turns %j into the number %j', async (limit, number) => {
    await expect(check(limit)).resolves.toStrictEqual({ limit: number, errors: [] })
  })

  it('keeps the default of the class when the parameter is left out', async () => {
    await expect(check()).resolves.toStrictEqual({ limit: 50, errors: [] })
  })

  it('accepts a number that is already a number', async () => {
    await expect(check(20)).resolves.toStrictEqual({ limit: 20, errors: [] })
  })

  it.each([
    ['below the minimum', '0'],
    ['above the maximum', '101'],
    ['far above the maximum', '999999999999999'],
    ['negative', '-1'],
    ['a plus sign', '+5'],
    ['a decimal point', '1.5'],
    ['a whole number with a decimal point', '1.0'],
    ['a decimal comma', '1,5'],
    ['an exponent', '1e2'],
    ['hexadecimal', '0x10'],
    ['a leading zero', '01'],
    ['a leading space', ' 2'],
    ['a trailing space', '2 '],
    ['letters', 'abc'],
    ['the empty string', ''],
    ['16 digits', '1000000000000000'],
    ['a repeated parameter', ['1', '2']],
    ['a number below the minimum', 0],
    ['a fraction', 2.5],
    ['null', null],
  ])('refuses %s', async (_name, limit) => {
    await expect(check(limit)).resolves.toMatchObject({ errors: ['limit must be a whole number from 1 to 100'] })
  })

  it('leaves a refused value as it came', async () => {
    await expect(check('1e2')).resolves.toMatchObject({ limit: '1e2' })
  })
})
