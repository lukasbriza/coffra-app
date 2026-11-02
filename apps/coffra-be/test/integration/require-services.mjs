import net from 'node:net'

import { databaseUrl } from './database-url.mjs'
import { redisUrl } from './redis-url.mjs'

// Runs before `pnpm test:integration` and `pnpm test:image` (the `pretest:*` scripts): one TCP connection to the
// Postgres and one to the Redis of the suites. When nothing listens on one of them, it says how to start the
// infrastructure and fails before vitest starts, instead of a stack trace from a global setup. Anything beyond
// "something listens" (credentials, a malformed URL) is left to the suites, which report it precisely.

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

/** The services the suites need: their connection string, the port when the URL has none, and how to start one alone. */
const SERVICES = [
  {
    name: 'Postgres',
    url: databaseUrl(),
    defaultPort: 5432,
    alone: 'docker compose -f docker/docker-compose.yaml up -d --wait postgres',
    other: 'set TEST_DATABASE_URL (its database name must start with coffra_test)',
  },
  {
    name: 'Redis',
    url: redisUrl(),
    defaultPort: 6379,
    alone: 'docker compose -f docker/docker-compose.yaml up -d --wait redis',
    other: 'set TEST_REDIS_URL',
  },
]

const missing = []

for (const service of SERVICES) {
  if (!URL.canParse(service.url)) {
    continue
  }

  const { hostname, port } = new URL(service.url)
  // `[::1]` → `::1`; the default port of the service unless the URL says otherwise.
  const host = hostname.replace(/^\[(.*)\]$/u, '$1')
  const portNumber = Number(port || service.defaultPort)

  // One at a time: the loopback of some machines does not like many connections at once.
  if (!(await isListening(host, portNumber))) {
    missing.push({ ...service, address: `${host}:${portNumber}` })
  }
}

if (missing.length > 0) {
  process.stderr.write(
    [
      '',
      ...missing.map((service) => `  ${service.name} is not running on ${service.address}.`),
      '',
      '  The specs need the dev infrastructure. Start it first (Docker must be running):',
      '',
      '    pnpm infra:up',
      '',
      ...missing.flatMap((service) => [
        `  ${service.name} alone: ${service.alone}`,
        `  Another server: ${service.other}.`,
      ]),
      '',
      '',
    ].join('\n'),
  )
  process.exitCode = 1
}
