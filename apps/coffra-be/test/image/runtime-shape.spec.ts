import { describe, expect, it } from 'vitest'

import { docker, runOnce } from './support/container'
import { IMAGE } from './support/environment'

/** The part of `docker image inspect` the specs read. */
type ImageConfig = { User: string; Env: string[]; Healthcheck?: { Test: string[] } }

/**
 * Reads the configuration Docker holds for the image.
 *
 * @returns the user, the environment and the health check of the image
 * @throws Error when the image cannot be inspected
 */
const inspectImage = async (): Promise<ImageConfig> => {
  const result = await docker(['image', 'inspect', IMAGE])
  const image = (JSON.parse(result.output) as { Config: ImageConfig }[]).at(0)

  if (image === undefined) {
    throw new Error(`The image ${IMAGE} cannot be inspected:\n${result.output}`)
  }

  return image.Config
}

/**
 * Runs a shell script in a fresh container of the image.
 *
 * @param script - the script, run with `sh -c`
 * @returns the exit code and the output
 */
const shell = (script: string) => runOnce({ entrypoint: 'sh', command: ['-c', script] })

describe('the image', () => {
  it('runs as the node user, not as root', async () => {
    const { User } = await inspectImage()
    const result = await shell('id -u')

    expect(User).toBe('node')
    expect(result.output.trim()).not.toBe('0')
  })

  it('defines a HEALTHCHECK on the health route', async () => {
    const { Healthcheck } = await inspectImage()

    expect(Healthcheck?.Test.join(' ')).toContain('/api/health')
  })

  it('carries no configuration and no secret', async () => {
    const { Env } = await inspectImage()
    const names = Env.map((entry) => entry.split('=', 1)[0] ?? '')

    expect(names.filter((name) => /SECRET|PASSWORD|TOKEN|DATABASE|OIDC|JWT/u.test(name))).toEqual([])
    expect(Env).toContain('NODE_ENV=production')
  })

  it('holds the compiled app, its schema and nothing else', async () => {
    const folder = await shell('ls -A /app/apps/coffra-be')
    const envFiles = await shell("find /app -name '.env*' -not -path '*/node_modules/*'")

    expect(folder.output.trim().split('\n').toSorted()).toEqual([
      'build',
      'node_modules',
      'package.json',
      'prisma',
      'prisma.config.ts',
    ])
    expect(envFiles.output.trim()).toBe('')
  })

  it('cannot rewrite its own code', async () => {
    const result = await shell('touch /app/apps/coffra-be/build/probe')

    expect(result.code).not.toBe(0)
  })

  it('runs on a Node that openid-client accepts (22.12 or newer)', async () => {
    const result = await runOnce({ entrypoint: 'node', command: ['-p', 'process.versions.node'] })
    const [major = 0, minor = 0] = result.output.trim().split('.').map(Number)

    expect(major > 22 || (major === 22 && minor >= 12)).toBe(true)
  })
})
