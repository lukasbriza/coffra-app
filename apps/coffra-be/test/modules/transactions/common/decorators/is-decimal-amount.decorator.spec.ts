import 'reflect-metadata'

import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'

import { IsDecimalAmount } from '../../../../../src/modules/transactions/common/decorators/is-decimal-amount.decorator'

class Probe {
  @IsDecimalAmount()
  amount!: unknown
}

const errorsOf = async (amount: unknown): Promise<string[]> => {
  const errors = await validate(plainToInstance(Probe, { amount }))
  return errors.flatMap((error) => Object.values(error.constraints ?? {}))
}

describe('@IsDecimalAmount()', () => {
  it.each([
    '0',
    '-0',
    '1250',
    '1250.5',
    '-1500.25',
    '0.0001',
    '007.10',
    '999999999999999.9999',
    '-999999999999999.9999',
  ])('accepts %j', async (amount) => {
    await expect(errorsOf(amount)).resolves.toEqual([])
  })

  it.each([
    ['a JSON number', 1250.5],
    ['a JSON integer', 0],
    ['five decimal places', '0.00001'],
    ['16 integer digits', '1000000000000000'],
    ['an exponent', '1e3'],
    ['a plus sign', '+5'],
    ['no integer part', '.5'],
    ['no decimal part after the point', '5.'],
    ['a decimal comma', '12,5'],
    ['spaces', ' 12.5'],
    ['a thousands separator', '1 000'],
    ['a trailing newline', '12.5\n'],
    ['the empty string', ''],
    ['a lone minus', '-'],
    ['null', null],
    ['undefined', undefined],
    ['NaN', 'NaN'],
    ['Infinity', 'Infinity'],
  ])('refuses %s', async (_name, amount) => {
    await expect(errorsOf(amount)).resolves.toEqual([
      'amount must be a decimal string with at most 15 integer digits and 4 decimal places',
    ])
  })
})
