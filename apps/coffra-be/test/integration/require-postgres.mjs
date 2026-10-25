import net from 'node:net'

import { databaseUrl } from './database-url.mjs'

// Runs before `pnpm test:integration` (the `pretest:integration` script): one TCP connection to the Postgres of the
// suite. When nothing listens there, it says how to start the infrastructure and fails before vitest starts, instead
// of a stack trace from the global setup. Anything beyond "something listens" (credentials, a malformed URL) is left
// to the global setup, which reports it precisely.

const TIMEOUT_MS = 2000

/**
 * Tries one TCP connection.
 *
 * @param {string} host - host name or IP address
 * @param {number} port - TCP port
 * @returns {Promise<boolean>} whether something accepted the connection in time
 */
const isListening = (host, port) =>
  new Promise((resolve) => {
    const socket = net.connect({ host, port })

    socket.setTimeout(TIMEOUT_MS)
    socket.once('connect', () => {
      socket.end()
      resolve(true)
    })
    socket.once('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.once('error', () => {
      resolve(false)
    })
  })

const url = databaseUrl()

if (URL.canParse(url)) {
  const { hostname, port } = new URL(url)
  // `[::1]` → `::1`; Postgres listens on 5432 unless the URL says otherwise.
  const host = hostname.replace(/^\[(.*)\]$/u, '$1')
  const address = `${host}:${port || '5432'}`

  if (!(await isListening(host, Number(port || 5432)))) {
    process.stderr.write(
      [
        '',
        `  Postgres is not running on ${address}.`,
        '',
        '  The integration specs need the dev infrastructure. Start it first (Docker must be running):',
        '',
        '    pnpm infra:up',
        '',
        '  Postgres alone, without Keycloak: docker compose -f docker/docker-compose.yaml up -d --wait postgres',
        '  Another server: set TEST_DATABASE_URL (its database name must start with coffra_test).',
        '',
        '',
      ].join('\n'),
    )
    process.exitCode = 1
  }
}
