import { execFile, type ExecFileException } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../../scripts/openapi/build-open-api-document'
import { EXPORT_ENV, EXPORT_USAGE } from '../../../scripts/openapi/constants'
import { serializeOpenApi } from '../../../scripts/openapi/serialize-open-api'
import { countOperations } from '../../../scripts/openapi/utils/count-operations'
import { describeExport } from '../../../scripts/openapi/utils/describe-export'
import { AppModule } from '../../../src/app.module'
import { validateEnv } from '../../../src/modules/config/env.validation'

// `pnpm openapi:export` as it runs: compiled with `tsc` by the same config, then the compiled file in a process of its
// own, without pnpm. The specs of `test/scripts/openapi/` build the document in this process; this one proves that the
// command gives the same bytes, with no environment and no `.env`, and with a hostile one.

/** The folder of the app: the compiled export resolves its dependencies from there. */
const APP_DIR = path.join(__dirname, '..', '..', '..')

/** The compiler of the app. */
const TSC = path.join(APP_DIR, 'node_modules', 'typescript', 'bin', 'tsc')

/** The compiled command line (`outDir` of `tsconfig.openapi.json`). */
const MAIN = path.join(APP_DIR, 'build', 'openapi', 'scripts', 'openapi', 'main.js')

/** A `.env` a developer could have, wrong in required and optional variables alike. */
const HOSTILE_DOT_ENV = 'TRUST_PROXY_HOPS=99\nSWAGGER_ENABLED=maybe\nCORS_ORIGINS=*\nREDIS_URL=not-a-url\n'

/** What the command line printed and how it ended. */
type Run = { code: number; stdout: string; stderr: string }

/**
 * The exit code of a finished process.
 *
 * @param error - what `execFile` reports: `null` for exit code 0, otherwise the failure
 * @returns the exit code, or `-1` when the process did not exit with one (it could not start, or timed out)
 */
const exitCodeOf = (error: ExecFileException | null): number => {
  if (error === null) {
    return 0
  }

  return typeof error.code === 'number' ? error.code : -1
}

/**
 * Runs a Node script in a process of its own.
 *
 * @param file - the script
 * @param args - its arguments
 * @param options - the working directory and the environment of the process
 * @param options.cwd - the working directory
 * @param options.env - the environment
 * @returns the exit code and the output
 */
const runNode = (file: string, args: string[], { cwd, env }: { cwd: string; env: NodeJS.ProcessEnv }): Promise<Run> =>
  new Promise((resolve) => {
    execFile(process.execPath, [file, ...args], { cwd, env, timeout: 60_000 }, (error, stdout, stderr) => {
      resolve({ code: exitCodeOf(error), stdout, stderr })
    })
  })

/**
 * The environment of this process without a single variable of the app: what a machine without a `.env` has.
 *
 * @returns the environment
 */
const bareEnvironment = (): NodeJS.ProcessEnv =>
  Object.fromEntries(Object.entries(process.env).filter(([name]) => !(name in EXPORT_ENV)))

describe('pnpm openapi:export', () => {
  let workDir = ''
  let expected = ''
  let operations = 0

  /**
   * Makes an empty folder for one run.
   *
   * @param name - its name inside the folder of the spec
   * @returns its path
   */
  const folder = (name: string): string => {
    const dir = path.join(workDir, name)

    mkdirSync(dir)

    return dir
  }

  beforeAll(async () => {
    const compiled = await runNode(TSC, ['-p', 'tsconfig.openapi.json'], { cwd: APP_DIR, env: process.env })

    expect(compiled).toMatchObject({ code: 0, stderr: '' })

    workDir = mkdtempSync(path.join(os.tmpdir(), 'coffra-openapi-'))

    const document = await buildOpenApiDocument(AppModule)

    expected = serializeOpenApi(document)
    operations = countOperations(document)
  }, 120_000)

  afterAll(() => {
    rmSync(workDir, { recursive: true, force: true })
  })

  it('writes the document of the app with no environment, no .env and nothing to connect to', async () => {
    const cwd = folder('bare')
    const run = await runNode(MAIN, ['--out', 'schema.json'], { cwd, env: bareEnvironment() })

    expect(run).toStrictEqual({ code: 0, stdout: `${describeExport(operations, 'schema.json')}\n`, stderr: '' })
    expect(readFileSync(path.join(cwd, 'schema.json'), 'utf8')).toBe(expected)
  }, 30_000)

  it('writes the same bytes with a hostile environment and .env', async () => {
    const cwd = folder('hostile')
    const env = { ...bareEnvironment(), NODE_ENV: 'development', DATABASE_URL: 'not-a-url', SWAGGER_ENABLED: 'false' }

    writeFileSync(path.join(cwd, '.env'), HOSTILE_DOT_ENV)
    // The control: the app would refuse to start with these values, so the export really replaced them.
    expect(() => validateEnv({ ...EXPORT_ENV, REDIS_URL: 'not-a-url', TRUST_PROXY_HOPS: '99', ...env })).toThrow(
      'Invalid environment configuration',
    )

    const run = await runNode(MAIN, ['--out', 'schema.json'], { cwd, env })

    expect(run).toMatchObject({ code: 0, stderr: '' })
    expect(readFileSync(path.join(cwd, 'schema.json'), 'utf8')).toBe(expected)
  }, 30_000)

  it.each([
    ['without --out', [], '--out is required'],
    ['with an unknown option', ['--out', 'schema.json', '--force'], "Unknown option '--force'"],
    ['into a folder that does not exist', ['--out', path.join('missing', 'schema.json')], 'ENOENT'],
  ])(
    'fails %s: exit code 1, the reason, and no file',
    async (name, args, reason) => {
      const cwd = folder(name.replaceAll(/\W+/gu, '-'))
      const run = await runNode(MAIN, args, { cwd, env: bareEnvironment() })

      expect(run.code).toBe(1)
      expect(run.stdout).toBe('')
      expect(run.stderr).toContain(reason)
      expect(readdirSync(cwd)).toStrictEqual([])
      expect(existsSync(path.join(cwd, 'missing'))).toBe(false)
    },
    30_000,
  )

  it('names the usage when the call is wrong', async () => {
    const run = await runNode(MAIN, [], { cwd: folder('usage'), env: bareEnvironment() })

    expect(run.stderr).toContain(EXPORT_USAGE)
  }, 30_000)
})
