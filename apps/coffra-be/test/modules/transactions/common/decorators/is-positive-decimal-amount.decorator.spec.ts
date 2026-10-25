import 'reflect-metadata'

import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'

import { IsPositiveDecimalAmount } from '../../../../../src/modules/transactions/common/decorators/is-positive-decimal-amount.decorator'

class Probe {
  @IsPositiveDecimalAmount()
  amount!: unknown
}

const errorsOf = async (amount: unknown): Promise<string[]> => {
  const errors = await validate(plainToInstance(Probe, { amount }))
  return errors.flatMap((error) => Object.values(error.constraints ?? {}))
}

describe('@IsPositiveDecimalAmount()', () => {
  it.each(['1', '0.0001', '1250', '1250.5', '007.10', '0.5', '10.0000', '999999999999999.9999'])(
    'accepts %j',
    async (amount) => {
      await expect(errorsOf(amount)).resolves.toEqual([])
    },
  )

  it.each([
    ['zero', '0'],
    ['zero with decimal places', '0.0000'],
    ['zero with leading zeros', '000'],
    ['zero with both', '00.00'],
    ['a negative amount', '-5'],
    ['a negative zero', '-0'],
    ['a JSON number', 1250.5],
    ['a JSON integer', 5],
    ['five decimal places', '0.00001'],
    ['16 integer digits', '1000000000000000'],
    ['an exponent', '1e3'],
    ['a plus sign', '+5'],
    ['no integer part', '.5'],
    ['no decimal part after the point', '5.'],
    ['a decimal comma', '12,5'],
    ['spaces', ' 12.5'],
    ['a trailing newline', '12.5\n'],
    ['the empty string', ''],
    ['null', null],
    ['undefined', undefined],
  ])('refuses %s', async (_name, amount) => {
    await expect(errorsOf(amount)).resolves.toEqual([
      'amount must be a positive decimal string with at most 15 integer digits and 4 decimal places',
    ])
  })
})
