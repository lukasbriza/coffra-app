import { describe, expect, it } from 'vitest'

import { EXPORT_USAGE } from '../../../scripts/openapi/constants'
import { parseExportArgs } from '../../../scripts/openapi/parse-export-args'

describe('parseExportArgs', () => {
  it.each([[['--out', 'schema.json']], [['--out=schema.json']], [['--', '--out', 'schema.json']]])(
    'reads the file from %j',
    (argv) => {
      expect(parseExportArgs(argv)).toStrictEqual({ out: 'schema.json' })
    },
  )

  it.each([
    [[], '--out is required'],
    [['--out='], '--out is required'],
    [['--out'], "Option '--out <value>' argument missing"],
    [['--out', 'schema.json', '--force'], "Unknown option '--force'"],
    [['--out', 'schema.json', 'extra'], "Unexpected argument 'extra'"],
  ])('refuses %j with the reason and the usage', (argv, reason) => {
    expect(() => parseExportArgs(argv)).toThrow(reason)
    expect(() => parseExportArgs(argv)).toThrow(EXPORT_USAGE)
  })
})
