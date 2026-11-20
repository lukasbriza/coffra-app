import { writeFile } from 'node:fs/promises'
import path from 'node:path'

import { describeError } from '../../src/utils'

import { EXPORT_ENV } from './constants'
import { parseExportArgs } from './parse-export-args'
import { serializeOpenApi } from './serialize-open-api'
import { countOperations } from './utils/count-operations'
import { describeExport } from './utils/describe-export'

// `pnpm openapi:export --out <file>`: the command line around `buildOpenApiDocument`. It is compiled with `tsc`, not
// run with `tsx`: the document needs the decorator metadata, which esbuild does not emit. It needs no database, Redis
// or `.env`, and prints one sentence.

/** Writes the OpenAPI document of the app to the file named by `--out`. */
const main = async (): Promise<void> => {
  const { out } = parseExportArgs(process.argv.slice(2))

  Object.assign(process.env, EXPORT_ENV)

  // Only now: importing the app reads and validates the environment at once.
  const [{ AppModule }, { buildOpenApiDocument }] = await Promise.all([
    import('../../src/app.module.js'),
    import('./build-open-api-document.js'),
  ])
  const document = await buildOpenApiDocument(AppModule)

  await writeFile(path.resolve(out), serializeOpenApi(document), 'utf8')
  process.stdout.write(`${describeExport(countOperations(document), out)}\n`)
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : describeError(error)}\n`)
  process.exitCode = 1
})
