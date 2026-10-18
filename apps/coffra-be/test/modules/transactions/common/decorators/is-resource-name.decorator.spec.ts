import 'reflect-metadata'

import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'

import { IsResourceName } from '../../../../../src/modules/transactions/common/decorators/is-resource-name.decorator'

class Probe {
  @IsResourceName()
  name!: unknown
}

const check = async (name: unknown): Promise<{ name: unknown; errors: string[] }> => {
  const probe = plainToInstance(Probe, { name })
  const errors = await validate(probe)
  return { name: probe.name, errors: errors.flatMap((error) => Object.keys(error.constraints ?? {})) }
}

/** The failed constraints only. */
const errorsOf = async (name: unknown): Promise<string[]> => {
  const { errors } = await check(name)
  return errors
}

describe('@IsResourceName()', () => {
  it('accepts a name and keeps it as it is', async () => {
    expect(await check('Main account')).toStrictEqual({ name: 'Main account', errors: [] })
  })

  it('trims the name before it is validated and stored', async () => {
    expect(await check('  Food \n')).toStrictEqual({ name: 'Food', errors: [] })
  })

  it('accepts 100 characters and refuses 101, counted after trimming', async () => {
    expect(await errorsOf('a'.repeat(100))).toEqual([])
    expect(await errorsOf(` ${'a'.repeat(100)} `)).toEqual([])
    expect(await errorsOf('a'.repeat(101))).toEqual(['maxLength'])
  })

  it.each(['', ' '.repeat(3), '\t\n'])('refuses the blank name %j', async (name) => {
    expect(await errorsOf(name)).toEqual(['isNotEmpty'])
  })

  it.each([42, null, undefined, ['Food'], { name: 'Food' }])('refuses %j', async (name) => {
    expect(await errorsOf(name)).toContain('isString')
  })
})
