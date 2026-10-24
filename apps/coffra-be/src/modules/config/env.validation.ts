import 'reflect-metadata'

import { plainToInstance, Type } from 'class-transformer'
import { IsEnum, IsInt, IsNotEmpty, IsString, IsUrl, Matches, Max, Min, MinLength, validateSync } from 'class-validator'

/** The environment the application runs in. */
export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/** What counts as a URL in the environment: a host without a top-level domain (`localhost`) is fine, `http` or `https`. */
const URL_OPTIONS = { require_tld: false, protocols: ['http', 'https'], require_protocol: true }

/**
 * The environment variables of the application, validated at startup by `validateEnv`.
 *
 * @property NODE_ENV - the environment the application runs in; `development` when left out
 * @property PORT - port the HTTP server listens on, 1 to 65535; `3000` when left out
 * @property DATABASE_URL - Postgres connection string (`postgres://` or `postgresql://`)
 * @property OIDC_ISSUER_URL - issuer of the identity provider; must be `https` in production
 * @property OIDC_CLIENT_ID - id of the client registered at the identity provider
 * @property OIDC_CLIENT_SECRET - secret of that client
 * @property OIDC_REDIRECT_URI - callback the identity provider sends the browser back to; must be `https` in production
 * @property JWT_ACCESS_SECRET - signs access tokens; at least 32 characters, different from the other secrets
 * @property JWT_REFRESH_SECRET - signs refresh tokens; at least 32 characters, different from the other secrets
 * @property AUTH_CHECKS_SECRET - signs the short-lived cookie that carries the OIDC login checks between `login` and
 * the callback; at least 32 characters, different from the JWT secrets
 * @property JWT_ACCESS_TTL_SECONDS - lifetime of an access token in seconds; `900` when left out
 * @property JWT_REFRESH_TTL_SECONDS - lifetime of a session from the login in seconds; `2592000` (30 days) when left
 * out
 */
export class Env {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65_535)
  PORT = 3000

  @Matches(/^postgres(ql)?:\/\/.+/, {
    message: 'DATABASE_URL must be a postgres:// or postgresql:// connection string',
  })
  DATABASE_URL!: string

  @IsUrl(URL_OPTIONS)
  OIDC_ISSUER_URL!: string

  @IsString()
  @IsNotEmpty()
  OIDC_CLIENT_ID!: string

  @IsString()
  @IsNotEmpty()
  OIDC_CLIENT_SECRET!: string

  @IsUrl(URL_OPTIONS)
  OIDC_REDIRECT_URI!: string

  @IsString()
  @MinLength(32)
  JWT_ACCESS_SECRET!: string

  @IsString()
  @MinLength(32)
  JWT_REFRESH_SECRET!: string

  @IsString()
  @MinLength(32)
  AUTH_CHECKS_SECRET!: string

  @Type(() => Number)
  @IsInt()
  @Min(1)
  JWT_ACCESS_TTL_SECONDS = 900

  @Type(() => Number)
  @IsInt()
  @Min(1)
  JWT_REFRESH_TTL_SECONDS = 2_592_000
}

/**
 * Validates the raw environment at startup.
 *
 * Besides the rules on each variable it checks that the three secrets differ, so one kind of signed value is never
 * accepted as another, and that production uses `https` for the issuer and the redirect URI. The message never
 * includes values, so secrets cannot leak into logs.
 *
 * @param config - the raw environment, variable name to value
 * @returns the validated variables with their defaults filled in
 * @throws Error listing one `VARIABLE: reason` per line when anything is invalid
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const env = plainToInstance(Env, config)
  const errors = validateSync(env, { skipMissingProperties: false })

  const problems = errors.flatMap((error) =>
    Object.values(error.constraints ?? {}).map((message) =>
      message.startsWith(error.property) ? message : `${error.property}: ${message}`,
    ),
  )

  const isValid = (...properties: string[]): boolean => !errors.some((error) => properties.includes(error.property))

  // Distinct secrets stop one kind of signed value from being accepted as another: a refresh token as an
  // access token, the login-checks cookie as either of them.
  if (isValid('JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET') && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    problems.push('JWT_REFRESH_SECRET: must differ from JWT_ACCESS_SECRET')
  }

  if (isValid('AUTH_CHECKS_SECRET')) {
    if (env.AUTH_CHECKS_SECRET === env.JWT_ACCESS_SECRET) {
      problems.push('AUTH_CHECKS_SECRET: must differ from JWT_ACCESS_SECRET')
    }

    if (env.AUTH_CHECKS_SECRET === env.JWT_REFRESH_SECRET) {
      problems.push('AUTH_CHECKS_SECRET: must differ from JWT_REFRESH_SECRET')
    }
  }

  // Plain http is tolerated for the dev Keycloak only: production must fail to start instead.
  // The Secure login cookie would silently not work on an http redirect URI either.
  if (env.NODE_ENV === NodeEnv.Production) {
    for (const property of ['OIDC_ISSUER_URL', 'OIDC_REDIRECT_URI'] as const) {
      if (isValid(property) && env[property].toLowerCase().startsWith('http:')) {
        problems.push(`${property}: must use https in production`)
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(`Invalid environment configuration:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`)
  }

  return env
}
