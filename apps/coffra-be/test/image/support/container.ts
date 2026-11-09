import { execFile } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { promisify, stripVTControlCharacters } from 'node:util'

import { CONTAINER_LABEL, HOST_ALIAS, IMAGE } from './environment'

// The Docker CLI, driven without a shell (no quoting, no `.cmd` shim on Windows).

const execute = promisify(execFile)

/** The command that applies the migrations; run in the working directory of the image. */
export const MIGRATE_COMMAND = ['node', 'node_modules/prisma/build/index.js', 'migrate', 'deploy']

/** What a Docker command did: its exit code and everything it printed, without terminal colours. */
export type DockerResult = {
  /** Exit code of the command. */
  code: number
  /** Standard output and standard error together. */
  output: string
}

/** How to run the image. */
export type RunOptions = {
  /** Environment variables of the container. */
  environment?: Record<string, string>
  /** Replaces the entry point of the image. */
  entrypoint?: string
  /** The command, instead of the default one. */
  command?: string[]
}

/** A running container of the image. */
export type App = {
  /** Id of the container. */
  id: string
  /**
   * Sends a `GET` to the server in the container.
   *
   * @param path - the path, starting with `/`
   * @returns the response
   */
  get: (path: string) => Promise<Response>
  /**
   * The state Docker holds for the `HEALTHCHECK` of the image.
   *
   * @returns `starting`, `healthy` or `unhealthy`
   */
  health: () => Promise<string>
  /**
   * Waits until the `HEALTHCHECK` passes.
   *
   * @param timeoutMs - how long to wait
   * @throws Error with the log of the container when it exits, turns unhealthy or the time runs out
   */
  waitHealthy: (timeoutMs?: number) => Promise<void>
  /**
   * The log of the container.
   *
   * @returns standard output and standard error, without terminal colours
   */
  logs: () => Promise<string>
  /**
   * Stops the container with SIGTERM and waits for it to exit (`docker stop` kills it after 10 s).
   *
   * @returns the exit code of the process
   */
  stop: () => Promise<number>
  /** Removes the container, running or not. */
  remove: () => Promise<void>
}

/**
 * Runs a Docker command.
 *
 * @param args - the arguments after `docker`
 * @returns the exit code and the output, whatever the code
 * @throws Error when Docker cannot be started at all
 */
export const docker = async (args: string[]): Promise<DockerResult> => {
  try {
    const { stdout, stderr } = await execute('docker', args, { maxBuffer: 32 * 1024 * 1024 })

    return { code: 0, output: stripVTControlCharacters(`${stdout}${stderr}`) }
  } catch (error) {
    const failure = error as { code?: number | string; stdout?: string; stderr?: string }

    // A string code (`ENOENT`) means the command did not run, a number is the exit code of one that did.
    if (typeof failure.code !== 'number') {
      throw new TypeError(`Docker could not be started: ${String(error)}`)
    }

    return { code: failure.code, output: stripVTControlCharacters(`${failure.stdout ?? ''}${failure.stderr ?? ''}`) }
  }
}

/**
 * The arguments every container of the suite gets: its label, the way to the host and its configuration.
 *
 * @param options - how to run the image
 * @returns arguments for `docker run`, before the image name
 */
const runArguments = ({ environment = {}, entrypoint }: RunOptions): string[] => [
  '--label',
  CONTAINER_LABEL,
  '--add-host',
  `${HOST_ALIAS}:host-gateway`,
  ...Object.entries(environment).flatMap(([name, value]) => ['-e', `${name}=${value}`]),
  ...(entrypoint === undefined ? [] : ['--entrypoint', entrypoint]),
]

/**
 * Runs the image to the end and removes the container.
 *
 * @param options - how to run the image
 * @returns the exit code and the output
 */
export const runOnce = (options: RunOptions): Promise<DockerResult> =>
  docker(['run', '--rm', ...runArguments(options), IMAGE, ...(options.command ?? [])])

/**
 * Removes every container of the suite, running or not.
 *
 * @returns once they are gone
 */
export const removeLeftovers = async (): Promise<void> => {
  const listed = await docker(['ps', '-aq', '--filter', `label=${CONTAINER_LABEL}`])
  const ids = listed.output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (ids.length > 0) {
    await docker(['rm', '-f', ...ids])
  }
}

/**
 * Starts the server of the image in the background, published on a free port of the loopback.
 *
 * The check of the image runs every 2 s instead of every 30 s, so a spec does not wait for it; the command of the check
 * is the one the image defines.
 *
 * @param environment - environment variables of the container
 * @returns the running container
 * @throws Error when the container cannot be started
 */
export const startApp = async (environment: Record<string, string>): Promise<App> => {
  const started = await docker([
    'run',
    '-d',
    ...runArguments({ environment }),
    '--health-interval',
    '2s',
    '--health-start-period',
    '5s',
    '-p',
    '127.0.0.1::3000',
    IMAGE,
  ])

  if (started.code !== 0) {
    throw new Error(`docker run failed:\n${started.output}`)
  }

  const id = started.output.trim().split('\n').at(-1) ?? ''
  const mapped = await docker(['port', id, '3000/tcp'])
  const port = Number(/:(\d+)\s*$/mu.exec(mapped.output.trim().split('\n', 1)[0] ?? '')?.[1])

  if (!Number.isInteger(port)) {
    throw new TypeError(`The port of ${id} is unknown:\n${mapped.output}`)
  }

  const inspect = async (format: string): Promise<string> => {
    const result = await docker(['inspect', '-f', format, id])

    return result.output.trim()
  }
  const logs = async (): Promise<string> => {
    const result = await docker(['logs', id])

    return result.output
  }

  return {
    id,
    // A timeout, so that a connection that stalls (see the note on Windows in `vitest.config.mjs`) fails and is retried
    // by `expect.poll` instead of hanging until the test times out
    get: (path) => fetch(`http://127.0.0.1:${port}${path}`, { signal: AbortSignal.timeout(5000) }),
    health: () => inspect('{{.State.Health.Status}}'),
    logs,
    async waitHealthy(timeoutMs = 60_000) {
      const deadline = Date.now() + timeoutMs

      for (;;) {
        const [health, status] = await Promise.all([inspect('{{.State.Health.Status}}'), inspect('{{.State.Status}}')])

        if (health === 'healthy') {
          return
        }

        if (health === 'unhealthy' || status !== 'running' || Date.now() > deadline) {
          throw new Error(`The container is ${status} and ${health}, not healthy:\n${await logs()}`)
        }

        await sleep(500)
      }
    },
    async stop() {
      await docker(['stop', '--time', '10', id])

      return Number(await inspect('{{.State.ExitCode}}'))
    },
    async remove() {
      await docker(['rm', '-f', id])
    },
  }
}
