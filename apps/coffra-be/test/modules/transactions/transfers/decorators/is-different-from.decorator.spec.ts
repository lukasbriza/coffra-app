import 'reflect-metadata'

import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'

import { IsAccountId } from '../../../../../src/modules/transactions/transfers/decorators/is-account-id.decorator'
import { IsDifferentFrom } from '../../../../../src/modules/transactions/transfers/decorators/is-different-from.decorator'

// The decorator alone, then together with `@IsAccountId()` on both ids, as a transfer declares them.

class Probe {
  from?: unknown

  @IsDifferentFrom('from')
  to?: unknown
}

class Accounts {
  @IsAccountId()
  from?: unknown

  @IsAccountId()
  @IsDifferentFrom('from')
  to?: unknown
}

const SOURCE = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d'
const TARGET = '6b7c8d9e-0f1a-4b2c-9d3e-4f5a6b7c8d9e'

const errorsOf = async (type: typeof Probe | typeof Accounts, from: unknown, to: unknown): Promise<string[]> => {
  const errors = await validate(plainToInstance(type, { from, to }))
  return errors.flatMap((error) => Object.values(error.constraints ?? {}))
}

describe('@IsDifferentFrom()', () => {
  it('accepts two different ids', async () => {
    await expect(errorsOf(Probe, SOURCE, TARGET)).resolves.toEqual([])
  })

  it('refuses the same id twice', async () => {
    await expect(errorsOf(Probe, SOURCE, SOURCE)).resolves.toEqual(['to must differ from from'])
  })

  it('passes when the other id is left out: whether the result is one account is not its to decide', async () => {
    await expect(errorsOf(Probe, undefined, TARGET)).resolves.toEqual([])
  })

  it.each([
    ['the other id is no UUID', 'abc', TARGET],
    ['its own id is no UUID', SOURCE, 'abc'],
    ['both are the same string but no UUID', 'abc', 'abc'],
  ])('passes when %s, and leaves it to the validator of that id', async (_name, from, to) => {
    await expect(errorsOf(Probe, from, to)).resolves.toEqual([])
  })

  it('reports two invalid ids once each, not a third time as the same', async () => {
    await expect(errorsOf(Accounts, 'abc', 'abc')).resolves.toEqual(['from must be a UUID', 'to must be a UUID'])
  })

  it('refuses one id spelled in two letter cases, behind @IsAccountId()', async () => {
    await expect(errorsOf(Accounts, SOURCE, SOURCE.toUpperCase())).resolves.toEqual(['to must differ from from'])
  })
})
