import 'reflect-metadata'

import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'

import { IsIsoDate } from '../../../../../src/modules/transactions/common/decorators/is-iso-date.decorator'
import { IsNotBefore } from '../../../../../src/modules/transactions/common/decorators/is-not-before.decorator'

// The decorator alone, then together with `@IsIsoDate()` on both ends, as a range is declared.

class Probe {
  from?: unknown

  @IsNotBefore('from')
  to?: unknown
}

class Range {
  @IsIsoDate()
  from?: unknown

  @IsIsoDate()
  @IsNotBefore('from')
  to?: unknown
}

const errorsOf = async (type: typeof Probe | typeof Range, from: unknown, to: unknown): Promise<string[]> => {
  const errors = await validate(plainToInstance(type, { from, to }))
  return errors.flatMap((error) => Object.values(error.constraints ?? {}))
}

describe('@IsNotBefore()', () => {
  it.each([
    ['a later day', '2026-10-01', '2026-10-31'],
    ['the same day: a range of one day', '2026-10-19', '2026-10-19'],
    ['a day of the next month', '2026-09-30', '2026-10-01'],
    ['a day of the next year', '2025-12-31', '2026-01-01'],
    ['the whole accepted range', '0001-01-01', '9999-12-31'],
  ])('accepts %s', async (_name, from, to) => {
    await expect(errorsOf(Probe, from, to)).resolves.toEqual([])
  })

  it.each([
    ['the day before', '2026-10-19', '2026-10-18'],
    ['a day of the month before', '2026-10-01', '2026-09-30'],
    ['a day of the year before', '2026-01-01', '2025-12-31'],
  ])('refuses %s', async (_name, from, to) => {
    await expect(errorsOf(Probe, from, to)).resolves.toEqual(['to must not be before from'])
  })

  it('passes when the other end is left out: the range is open there', async () => {
    await expect(errorsOf(Probe, undefined, '2026-10-19')).resolves.toEqual([])
  })

  it.each([
    ['is no date', 'yesterday', '2026-10-19'],
    ['is a day that does not exist', '2026-02-30', '2026-02-01'],
    ['has no leading zeros', '2026-10-9', '2026-10-01'],
  ])('passes when the other end %s, and leaves it to its own validator', async (_name, from, to) => {
    await expect(errorsOf(Probe, from, to)).resolves.toEqual([])
    await expect(errorsOf(Range, from, to)).resolves.toEqual(['from must be a calendar date YYYY-MM-DD'])
  })

  it('leaves an invalid value of its own property to its own validator', async () => {
    await expect(errorsOf(Range, '2026-10-19', '2026-02-30')).resolves.toEqual([
      'to must be a calendar date YYYY-MM-DD',
    ])
  })

  it('reports a range in the wrong order once, next to two valid days', async () => {
    await expect(errorsOf(Range, '2026-10-19', '2026-10-18')).resolves.toEqual(['to must not be before from'])
  })
})
