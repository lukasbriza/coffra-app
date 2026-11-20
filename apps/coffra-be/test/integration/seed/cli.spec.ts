import { execFile, type ExecFileException } from 'node:child_process'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { DEMO_USER } from '../../../scripts/seed/constants'
import { testDatabase } from '../support/test-database'
import { useIntegrationApp } from '../support/use-integration-app'

/** The folder of the app: `node --import tsx` finds `tsx` there, and `dotenv` looks for a `.env` there. */
const APP_DIR = path.join(__dirname, '..', '..', '..')

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
 * Runs `pnpm db:seed` without pnpm: the same file through the same loader (`tsx`), in a process of its own. The test
 * database goes in `DATABASE_URL` and wins over a developer's `.env` (`dotenv` does not overwrite), so this never reaches
 * the development database.
 *
 * @param nodeEnv - the `NODE_ENV` of the process
 * @returns the exit code and the output
 */
const runSeed = (nodeEnv: string): Promise<Run> => {
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  const url = process.env.DATABASE_URL

  testDatabase(url)

  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ['--import', 'tsx', 'scripts/seed/main.ts'],
      { cwd: APP_DIR, env: { ...process.env, NODE_ENV: nodeEnv, DATABASE_URL: url }, timeout: 60_000 },
      (error, stdout, stderr) => {
        resolve({ code: exitCodeOf(error), stdout, stderr })
      },
    )
  })
}

// The command line itself, as `pnpm db:seed` runs it: the refusal in production, and a run that works.
describe('the command line of the seed', () => {
  const { prisma, unchanged } = useIntegrationApp()

  it('refuses to run in production: it fails, says why, writes nothing and does not print the database', async () => {
    const run = await unchanged(() => runSeed('production'))

    expect(run.code).toBe(1)
    expect(run.stderr).toContain('Refusing to seed: NODE_ENV is production.')
    expect(run.stdout).toBe('')
    expect(`${run.stdout}${run.stderr}`).not.toContain('postgresql://')
  }, 30_000)

  it('seeds the demo user in development: exit code 0, a sentence about it, and the data in the database', async () => {
    const run = await runSeed('development')

    expect(run).toMatchObject({ code: 0, stderr: '' })
    expect(run.stdout).toMatch(
      /^Seeded dev@coffra\.local \(user [\da-f-]{36}\) for \d{4}-\d{2}-\d{2}: 4 accounts, 9 categories/u,
    )

    const user = await prisma().user.findFirstOrThrow({ where: { externalSubject: DEMO_USER.subject } })

    expect(await prisma().account.count({ where: { userId: user.id } })).toBe(4)
    expect(await prisma().transaction.count({ where: { account: { userId: user.id } } })).toBeGreaterThan(100)
  }, 30_000)
})
