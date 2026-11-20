import { parseArgs } from 'node:util'

import { describeError } from '../../src/utils'

import { EXPORT_USAGE } from './constants'
import type { ExportArgs } from './types'

/**
 * Reads the command line of the export: `--out <file>` (or `--out=<file>`), required, and nothing else.
 *
 * A leading `--` is skipped, so `pnpm openapi:export -- --out <file>` works too.
 *
 * @param argv - the arguments after the script (`process.argv.slice(2)`)
 * @returns where to write the document
 * @throws Error with the reason and the usage when `--out` is missing or empty, or for any other argument
 */
export const parseExportArgs = (argv: readonly string[]): ExportArgs => {
  const args = argv[0] === '--' ? argv.slice(1) : [...argv]

  try {
    const { values } = parseArgs({ args, options: { out: { type: 'string' } }, strict: true, allowPositionals: false })

    if (values.out === undefined || values.out === '') {
      throw new Error('--out is required')
    }

    return { out: values.out }
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : describeError(error)}\n${EXPORT_USAGE}`)
  }
}
