import 'reflect-metadata'

import { plainToInstance, Type } from 'class-transformer'
import { IsEnum, IsInt, IsNotEmpty, IsString, IsUrl, Matches, Max, Min, MinLength, validateSync } from 'class-validator'

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

const URL_OPTIONS = { require_tld: false, protocols: ['http', 'https'], require_protocol: true }

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
 * Validates raw env at startup. Throws listing `VARIABLE: reason` per line.
 * Never includes values, so secrets cannot leak into logs.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const env = plainToInstance(Env, config)
  const errors = validateSync(env, { skipMissingProperties: false })

  const problems = errors.flatMap((error) =>
    Object.values(error.constraints ?? {}).map((message) =>
      message.startsWith(error.property) ? message : `${error.property}: ${message}`,
    ),
  )

  // Distinct secrets stop a refresh token from being accepted as an access token.
  const secretsValid = !errors.some(
    (error) => error.property === 'JWT_ACCESS_SECRET' || error.property === 'JWT_REFRESH_SECRET',
  )

  if (secretsValid && env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    problems.push('JWT_REFRESH_SECRET: must differ from JWT_ACCESS_SECRET')
  }

  // Plain http is tolerated for the dev Keycloak only (ADR 0008): production must fail to start instead.
  const issuerValid = !errors.some((error) => error.property === 'OIDC_ISSUER_URL')

  if (issuerValid && env.NODE_ENV === NodeEnv.Production && env.OIDC_ISSUER_URL.toLowerCase().startsWith('http:')) {
    problems.push('OIDC_ISSUER_URL: must use https in production')
  }

  if (problems.length > 0) {
    throw new Error(`Invalid environment configuration:\n${problems.map((problem) => `  - ${problem}`).join('\n')}`)
  }

  return env
}
