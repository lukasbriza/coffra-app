import 'reflect-metadata'

import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'

import { IsNote } from '../../../../../src/modules/transactions/common/decorators/is-note.decorator'

class Probe {
  @IsNote()
  note?: unknown
}

const check = async (note?: unknown): Promise<{ note: unknown; errors: string[] }> => {
  const probe = plainToInstance(Probe, { note })
  const errors = await validate(probe)
  return { note: probe.note, errors: errors.flatMap((error) => Object.keys(error.constraints ?? {})) }
}

describe('@IsNote()', () => {
  it('accepts a note and keeps it as it is', async () => {
    await expect(check('Lunch with Anna')).resolves.toStrictEqual({ note: 'Lunch with Anna', errors: [] })
  })

  it('trims the note before it is validated and stored', async () => {
    await expect(check('  Lunch \n')).resolves.toStrictEqual({ note: 'Lunch', errors: [] })
  })

  it.each(['', ' '.repeat(3), '\t\n'])('turns the blank note %j into null: no note', async (note) => {
    await expect(check(note)).resolves.toStrictEqual({ note: null, errors: [] })
  })

  it('accepts null and no note at all', async () => {
    await expect(check(null)).resolves.toStrictEqual({ note: null, errors: [] })
    await expect(check()).resolves.toStrictEqual({ note: undefined, errors: [] })
  })

  it('accepts 500 characters and refuses 501, counted after trimming', async () => {
    await expect(check('a'.repeat(500))).resolves.toMatchObject({ errors: [] })
    await expect(check(` ${'a'.repeat(500)} `)).resolves.toMatchObject({ errors: [] })
    await expect(check('a'.repeat(501))).resolves.toMatchObject({ errors: ['maxLength'] })
  })

  it.each([42, true, ['Lunch'], { text: 'Lunch' }])('refuses %j', async (note) => {
    const { errors } = await check(note)

    expect(errors).toContain('isString')
  })
})
