import 'reflect-metadata'

import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'

import { IsAccountId } from '../../../../../src/modules/transactions/transfers/decorators/is-account-id.decorator'

class Probe {
  @IsAccountId()
  accountId?: unknown
}

const ID = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d'

const check = async (accountId: unknown): Promise<{ value: unknown; errors: string[] }> => {
  const probe = plainToInstance(Probe, { accountId })
  const errors = await validate(probe)

  return { value: probe.accountId, errors: errors.flatMap((error) => Object.values(error.constraints ?? {})) }
}

describe('@IsAccountId()', () => {
  it('accepts a UUID in lower case as it is', async () => {
    await expect(check(ID)).resolves.toEqual({ value: ID, errors: [] })
  })

  it.each([
    ['all in upper case', ID.toUpperCase()],
    ['in mixed case', '5A6b7C8d-9E0f-4A1b-8C2d-3E4f5A6b7C8d'],
  ])('lower-cases a UUID %s: it is the same account', async (_name, spelling) => {
    await expect(check(spelling)).resolves.toEqual({ value: ID, errors: [] })
  })

  it.each([
    ['no UUID', 'abc'],
    ['an empty string', ''],
    ['a UUID without dashes', ID.replaceAll('-', '')],
    ['a number', 42],
    ['null', null],
  ])('refuses %s and leaves it as it came', async (_name, value) => {
    await expect(check(value)).resolves.toEqual({ value, errors: ['accountId must be a UUID'] })
  })
})
