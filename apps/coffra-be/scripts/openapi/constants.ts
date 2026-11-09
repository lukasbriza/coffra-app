import type { Env } from '../../src/modules/config/env.validation'

/**
 * The environment the export builds the application in. It replaces whatever the process and a `.env` hold, so the
 * document never depends on the machine it is exported on.
 *
 * Every variable of the application is here, the optional ones too: one left out would be read from a developer's
 * `.env`, and a wrong value there would stop the export. It is the environment of production (`NODE_ENV`), because the
 * document describes the API as production serves it. Nothing in it is real: the hosts are on the reserved `.invalid`
 * domain, the database and Redis are on port 1, and nothing is ever connected to.
 */
export const EXPORT_ENV = {
  NODE_ENV: 'production',
  PORT: '3000',
  DATABASE_URL: 'postgresql://openapi:openapi@127.0.0.1:1/openapi',
  OIDC_ISSUER_URL: 'https://idp.invalid/realms/openapi',
  OIDC_CLIENT_ID: 'openapi-export',
  OIDC_CLIENT_SECRET: 'openapi-export-client-secret',
  OIDC_REDIRECT_URI: 'https://api.invalid/api/auth/callback',
  JWT_ACCESS_SECRET: 'openapi-export-access-secret-not-a-real-one',
  JWT_REFRESH_SECRET: 'openapi-export-refresh-secret-not-a-real-one',
  AUTH_CHECKS_SECRET: 'openapi-export-checks-secret-not-a-real-one',
  JWT_ACCESS_TTL_SECONDS: '900',
  JWT_REFRESH_TTL_SECONDS: '2592000',
  CORS_ORIGINS: '',
  TRUST_PROXY_HOPS: '0',
  RATE_LIMIT_TTL_SECONDS: '60',
  RATE_LIMIT_MAX: '120',
  RATE_LIMIT_AUTH_MAX: '10',
  REDIS_URL: 'redis://127.0.0.1:1',
  SWAGGER_ENABLED: 'false',
} as const satisfies Record<keyof Env, string>

/** The HTTP methods an OpenAPI path can hold an operation under. */
export const OPERATION_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const

/** How to call the command, added to the message of a wrong call. */
export const EXPORT_USAGE = 'Usage: pnpm openapi:export --out <file>'
